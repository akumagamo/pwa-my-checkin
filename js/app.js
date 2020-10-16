
const STORAGE_KEY = 'myCheckInStatusData';

const CSS_SCREEN_SHOW_BLOCK_PREFIX = 'app__screen--show-';

const APP_MODES = {
  START: 'start',
  USER: 'user',
  BUSINESS: 'business', 
  QR: 'qr',
};

let baseStatus = `{"mode": "${APP_MODES.START}"}`;

let myApp = {
  currentStatus: {},
  init: function init(){
    this.loadAppState();
    this.setupHTMLConnection();
    this.showCurrentScreen();
  },
  setupHTMLConnection: function setupHTMLConnection (){
    let that = this;

    that.htmlElement = document.querySelector('.js-app');

    document.querySelector('#userButton').addEventListener('click', that.HandelModeSelection.bind(that));
    document.querySelector('#businessButton').addEventListener('click', that.HandelModeSelection.bind(that));
    document.querySelector('#generateQrButton').addEventListener('click', that.HandelModeSelection.bind(that));
    document.querySelector('#editUserDataButton').addEventListener('click', that.HandelModeSelection.bind(that));

    window.onpopstate = function (event) {
      if (event.state) { 
        that.setMode(event.state.mode, false);
        that.showCurrentScreen();
      }
      console.info(event);
    };

  },
  HandelModeSelection: function HandelModeSelection(event){
    console.info(event.currentTarget);
    if(event.currentTarget.id === 'userButton') {
      this.setMode(APP_MODES.USER, true);
    } else if(event.currentTarget.id === 'businessButton') {
      this.setMode(APP_MODES.BUSINESS, true);
    } else if(event.currentTarget.id === 'generateQrButton') {
      this.setMode(APP_MODES.QR, true);
    }else if(event.currentTarget.id === 'editUserDataButton') {
      this.setMode(APP_MODES.USER, true);
    }
    
    this.showCurrentScreen();

  },
  setMode: function setMode(newMode, addToHistory){
    if(addToHistory){
      // TODO REFACTOR 
      window.history.pushState(this.currentStatus, null, "");
    }
    this.currentStatus.mode = newMode;
    this.saveCurrentStatus();
  },
  saveCurrentStatus: function saveCurrentStatus(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentStatus));
  },
  loadAppState: function loadAppState(){
    let savedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || baseStatus);
    this.currentStatus.mode = savedData.mode;
    window.history.replaceState(this.currentStatus, null, "");

    console.info(this.currentStatus);
  },
  updateView: function updateView(){
    this.showCurrentScreen();
  },
  hideAllScreens: function hideAllScreens(){
    this.htmlElement.classList.remove(
      CSS_SCREEN_SHOW_BLOCK_PREFIX + APP_MODES.START,
      CSS_SCREEN_SHOW_BLOCK_PREFIX + APP_MODES.USER,
      CSS_SCREEN_SHOW_BLOCK_PREFIX + APP_MODES.BUSINESS,
      CSS_SCREEN_SHOW_BLOCK_PREFIX + APP_MODES.QR,
    );
  },
  showCurrentScreen: function(){
    let currentScreen = APP_MODES.START;
    this.hideAllScreens();

    if(this.currentStatus && this.currentStatus.mode) {
      currentScreen = this.currentStatus.mode;
    }

    this.htmlElement.classList.add( CSS_SCREEN_SHOW_BLOCK_PREFIX + currentScreen);
  },
}

window.addEventListener('DOMContentLoaded', myApp.init.bind(myApp));