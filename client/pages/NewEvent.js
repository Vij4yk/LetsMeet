import _ from 'lodash';
import autobind from 'autobind-decorator';
import cssModules from 'react-css-modules';
import DayPicker, { DateUtils } from 'react-day-picker';
import moment from 'moment';
import noUiSlider from 'materialize-css/extras/noUiSlider/nouislider.min.js';
import React from 'react';
import fetch from 'isomorphic-fetch';
import { browserHistory } from 'react-router';
import { Notification } from 'react-notification';

import { checkStatus, parseJSON } from '../util/fetch.util';
import { formatTime, getHours, getMinutes } from '../util/time-format';
import { isAuthenticated, getCurrentUser } from '../util/auth';
import { dateRangeReducer } from '../util/dates.utils';

import 'materialize-css/extras/noUiSlider/nouislider.css';
import 'react-day-picker/lib/style.css';
import styles from '../styles/new-event.css';

class NewEvent extends React.Component {
  constructor() {
    super();
    this.state = {
      ranges: [{
        from: moment()
          .hour(0)
          .minute(0)
          .second(0)._d,
        to: moment()
          .hour(0)
          .minute(0)
          .second(0)._d,
      }],
      eventName: '',
      weekDays: {
        mon: false,
        tue: false,
        wed: false,
        thu: false,
        fri: false,
        sat: false,
        sun: false,
      },
      dateOrDay: false,
      selectedTimeRange: [0, 23],
      submitClass: 'waves-effect waves-light btn purple disabled',
      notificationIsActive: false,
      notificationMessage: '',
    };
  }

  async componentWillMount() {
    if (!await isAuthenticated()) {
      // find the current user aka possible owner
      this.state.curUser = await getCurrentUser();
      if (!sessionStorage.getItem('redirectTo')) {
        sessionStorage.setItem('redirectTo', '/event/new');
      }
      browserHistory.push('/');
    }
  }

  componentDidMount() {
    const slider = document.getElementById('timeSlider');
    noUiSlider.create(slider, {
      start: [9, 17],
      connect: true,
      step: 0.25,
      range: {
        min: 0,
        max: 24,
      },
      format: {
        to: val => formatTime(val),
        from: val => val,
      },
    });

    slider.noUiSlider.on('update', (value, handle) => {
      $('.range-label span').text('');
      const { selectedTimeRange } = this.state;
      selectedTimeRange[handle] = value[handle];
      this.setState({ selectedTimeRange });
    });

    $('.notification-bar-action').on('click', () => {
      this.setState({ notificationIsActive: false });
    });

    $('input[type="text"]+label').addClass('active');
  }

  @autobind
  toggleSubmitDisabled() {
    // Checks whether the event name and dates/weekDays have been entered. If so, un-disable the
    // submit button. Otherwise, disable the submit button (if it isn't already');

    const { submitClass, ranges, eventName, dateOrDay, weekDays } = this.state;

    if (!dateOrDay) { // dates
      if (ranges.length > 0 && ranges[0].from && eventName.length > 0) {
        this.setState({
          submitClass: submitClass.replace(' disabled', ''),
        });
      } else if (submitClass.indexOf('disabled') === -1) {
        this.setState({
          submitClass: `${submitClass} disabled`,
        });
      }
    } else { // weekdays
      let numOfWeekdaysSelected = 0;
      Object.keys(weekDays).forEach((weekDay) => {
        if (weekDays[weekDay]) numOfWeekdaysSelected += 1;
      });

      if (eventName.length > 0 && numOfWeekdaysSelected > 0) {
        this.setState({
          submitClass: submitClass.replace(' disabled', ''),
        });
      } else if (submitClass.indexOf('disabled') === -1) {
        this.setState({
          submitClass: `${submitClass} disabled`,
        });
      }
    }
  }

  @autobind
  handleDayClick(e, day, { disabled }) {
    if (disabled) return;

    // date ranges manipulation
    let ranges = _.map(this.state.ranges, _.clone); // deep copy this.state.ranges to ranges
    function removeRange(ranges, range) {
      const newRange = ranges.filter(r => !_.isEqual(r, range));
      if (newRange.length === 0) {
        return [{
          from: null,
          to: null,
        }];
      }
      return newRange;
    }


    // Check if day already exists in a range. If yes, remove it from all the
    // ranges that it exists in.
    for (const range of ranges) {
      if (DateUtils.isDayInRange(day, range)) {
        const { from, to } = range;
        const yesterday = moment(day).subtract(1, 'date')._d;
        const tomorrow = moment(day).add(1, 'date')._d;

        if (!DateUtils.isDayInRange(yesterday, range) && !DateUtils.isDayInRange(tomorrow, range)) {
          ranges = removeRange(ranges, range);
          continue;
        }

        if (!moment(day).isSame(from)) {
          ranges.push({
            from, to: yesterday,
          });
        }

        if (!moment(day).isSame(to)) {
          ranges.push({
            from: tomorrow, to,
          });
        }

        ranges = removeRange(ranges, range);
      }
    }

    // If the previous operation did not change the ranges array (i.e. the
    // clicked day wasn't already in a range), then either create a new range or
    // add it to the existing range.
    if (_.isEqual(ranges, this.state.ranges)) {
      if (!ranges[ranges.length - 1].from ||
          !ranges[ranges.length - 1].to) {
        ranges[ranges.length - 1] = DateUtils.addDayToRange(day, ranges[ranges.length - 1]);
        this.setState({ ranges }, () => this.toggleSubmitDisabled());
      } else {
        ranges.push({ from: null, to: null });
        ranges[ranges.length - 1] = DateUtils.addDayToRange(day, ranges[ranges.length - 1]);
        this.setState({ ranges }, () => this.toggleSubmitDisabled());
      }
    } else {
      this.setState({ ranges }, () => this.toggleSubmitDisabled());
    }
  }

  @autobind
  handleResetClick(e) {
    e.preventDefault();
    this.setState({ ranges: [{
      from: null,
      to: null,
    }] });
  }

  @autobind
  async createEvent(ev) {
    const {
      eventName: name,
      ranges,
      dateOrDay,
      weekDays,
      selectedTimeRange: [fromTime, toTime],
    } = this.state;

    // validate the form
    if (ev.target.className.indexOf('disabled') > -1) {

      if (!dateOrDay) { // dates
        if (ranges.length < 0 || !ranges[0].from && name.length === 0) {
          this.setState({
            notificationIsActive: true,
            notificationMessage: 'Please select a date and enter an event name.',
          });
        } else if (ranges.length < 0 || !ranges[0].from && name.length !== 0) {
          this.setState({
            notificationIsActive: true,
            notificationMessage: 'Please select a date.',
          });
        } else if (ranges.length > 0 || ranges[0].from && name.length === 0) {
          this.setState({
            notificationIsActive: true,
            notificationMessage: 'Please enter an event name.',
          });
        }

        return;
      }

      // weekdays form validator
      let numOfWeekdaysSelected = 0;

      Object.keys(weekDays).forEach((weekDay) => {
        if (weekDays[weekDay]) numOfWeekdaysSelected += 1;
      });

      if (name.length === 0 && numOfWeekdaysSelected === 0) {
        this.setState({
          notificationIsActive: true,
          notificationMessage: 'Please select a weekday and enter an event name.',
        });
      } else if (name.length !== 0 && numOfWeekdaysSelected === 0) {
        this.setState({
          notificationIsActive: true,
          notificationMessage: 'Please select a weekday.',
        });
      } else if (name.length === 0 && numOfWeekdaysSelected !== 0) {
        this.setState({
          notificationIsActive: true,
          notificationMessage: 'Please enter an event name.',
        });
      }

      return;
    }

    let sentData;

    const fromHours = getHours(fromTime);
    const toHours = getHours(toTime);

    const fromMinutes = getMinutes(fromTime);
    const toMinutes = getMinutes(toTime);
    // create a date range as date
    if (dateOrDay) {
      const dates = [];

      Object.keys(weekDays).forEach((key) => {
        if (weekDays[key]) {
          dates.push({
            fromDate: moment()
                      .day(key)
                      .set('h', fromHours)
                      .set('m', fromMinutes),
            toDate: moment()
                      .day(key)
                      .set('h', toHours)
                      .set('m', toMinutes),
          });
        }
      });

      sentData = JSON.stringify({ name, weekDays, dates });
    } else {
      let dates = ranges.map(({ from, to }) => {
        if (!to) to = from;

        if (from > to) {
          [from, to] = [to, from];
        }

        return {
          fromDate: moment(from).set('h', fromHours).set('m', fromMinutes)._d,
          toDate: moment(to).set('h', toHours).set('m', toMinutes)._d,
        };
      });

      dates = dateRangeReducer(dates);
      // the field active now has a default of true.
      sentData = JSON.stringify({ name, dates });
    }

    const response = await fetch('/api/events', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: sentData,
      credentials: 'same-origin',
    });

    let newEvent;
    try {
      checkStatus(response);
      newEvent = await parseJSON(response);
    } catch (err) {
      console.log('err at POST NewEvent', err);
    } finally {
      browserHistory.push(`/event/${newEvent._id}`);
    }
  }

  @autobind
  handleEventNameChange(ev) {
    this.setState({ eventName: ev.target.value }, () => this.toggleSubmitDisabled());
  }
  @autobind
  handleWeekdaySelect(ev) {
    if (ev.target.className.indexOf('disabled') > -1) {
      ev.target.className = ev.target.className.replace('disabled', '');
    } else {
      ev.target.className += 'disabled';
    }

    const { weekDays } = this.state;
    const weekDay = ev.target.text.toLowerCase();
    weekDays[weekDay] = !weekDays[weekDay];
    this.setState({ weekDays }, () => this.toggleSubmitDisabled());
  }

  @autobind
  handleDateOrDay() {
    this.setState({ dateOrDay: !this.state.dateOrDay }, () => this.toggleSubmitDisabled());
  }

  render() {
    const modifiers = {
      selected: day =>
        DateUtils.isDayInRange(day, this.state) ||
        this.state.ranges.some(v => DateUtils.isDayInRange(day, v)),
    };

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const { from, to } = this.state.ranges[0];

    return (
      <div className="card" styleName="new-event-card">
        <div className="card-content">
          <h1 className="card-title">Create a New Event</h1>
          <form>
            <div className="row">
              <div className="input-field col s12">
                <input
                  id="event_name"
                  type="text"
                  value={this.state.eventName}
                  onChange={this.handleEventNameChange}
                  className="validate"
                  placeholder="Enter an event name..."
                  autoFocus
                />
                <label htmlFor="event_name">Event Name</label>
              </div>
            </div>
            {!this.state.dateOrDay ?
              <div>
                <h6 styleName="heading-dates">What dates might work for you?</h6>
                {from && to &&
                  <p className="center">
                    <a
                      className="btn-flat"
                      href="#reset"
                      onClick={this.handleResetClick}
                    >Reset</a>
                  </p>
                }
                <DayPicker
                  numberOfMonths={2}
                  fromMonth={new Date()}
                  disabledDays={DateUtils.isPastDay}
                  modifiers={modifiers}
                  onDayClick={this.handleDayClick}
                  styleName="daypicker"
                />
              </div> :
              <div>
                <h6 styleName="heading">What days might work for you?</h6>
                <div styleName="weekdayList">
                  {
                    weekDays.map((day, index) => (
                      <a
                        key={index}
                        className="btn-flat disabled"
                        onClick={this.handleWeekdaySelect}
                        style={{ cursor: 'pointer' }}
                      >{day}</a>
                    ))
                  }
                </div>
              </div>
            }
            <h6 styleName="heading">What times might work?</h6>
            <div id="timeSlider" />
            <br />
            <p className="center">
              From {this.state.selectedTimeRange[0]} to {this.state.selectedTimeRange[1]}
            </p>
            <br />
            <p className="center">
              <a className={this.state.submitClass} onClick={this.createEvent}>
                Create Event
              </a>
            </p>
          </form>
        </div>
        <Notification
          isActive={this.state.notificationIsActive}
          message={this.state.notificationMessage}
          action="Dismiss"
          title=" "
          onDismiss={() => this.setState({ notificationIsActive: false })}
          dismissAfter={10000}
          activeClassName="notification-bar-is-active"
        />
      </div>
    );
  }
}

export default cssModules(NewEvent, styles);
