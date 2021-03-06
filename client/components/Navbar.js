import React from 'react';
import { Link } from 'react-router';
import cssModules from 'react-css-modules';
import styles from '../styles/navbar.css';
import autobind from 'autobind-decorator';

import '../styles/no-css-modules/mdl.css';

class Navbar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      userAvatar: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png',
      user: false,
      conditionalHomeLink: '/',
    };
  }

  componentWillMount() {
    $.get('/api/auth/current', (user) => {
      if (user) {
        const userAvatar = user.avatar;
        this.setState({ userAvatar, user: true, curUser: user._id, conditionalHomeLink: '/Dashboard' });
      }
    });
  }

  @autobind
  handleAuthClick() {
    if (!sessionStorage.getItem('redirectTo')) {
      sessionStorage.setItem('redirectTo', this.props.location.pathname);
    }
  }

  renderNav() {
    if (this.state.user) {
      return (
        <div className="mdl-navigation">
          <Link className="mdl-navigation__link" to="/dashboard">Dashboard</Link>
          <a className="mdl-navigation__link" href="/api/auth/logout">Logout</a>
          <a className="mdl-navigation__link" href="#">
            <img
              alt="avatar"
              styleName="nav-img"
              src={this.state.userAvatar}
            />
          </a>
        </div>
      );
    }

    return (
      <div className="mdl-navigation" styleName="login-btn">
        <a
          className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-color--indigo"
          href="/api/auth/facebook"
          onClick={this.handleAuthClick}
        ><img src={require('../assets/facebook.png')} alt="Facebook Logo" /> Login with Facebook</a>
        <a
          className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-color--red"
          href="/api/auth/google"
          onClick={this.handleAuthClick}
        ><img src={require('../assets/google.png')} alt="Google Logo" /> Login with Google</a>
      </div>
    );
  }

  render() {
    return (
      <header className="mdl-layout__header">
        <div className="mdl-layout__header-row">
          <Link to={this.state.conditionalHomeLink} className="mdl-layout-title mdl-navigation__link">Lets Meet</Link>
          <div className="mdl-layout-spacer" />
          {this.renderNav()}
        </div>
      </header>
    );
  }
}

Navbar.propTypes = {
  location: React.PropTypes.object,
};

export default cssModules(Navbar, styles);
