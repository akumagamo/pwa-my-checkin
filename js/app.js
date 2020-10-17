
const STORAGE_KEY = 'myCheckInStatusData';
const CSS_SCREEN_SHOW_BLOCK_PREFIX = 'app__screen--show-';
const CSS_HIDE_CLASS = 'global__hide';

const EXTERNAL_LIB_SCRIPTS = ['js/qrcode.min.js'];

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
    this.loadExternalLibs();
    this.setupServiceWorker();
    this.checkDebugStatus();
    this.loadAppState();
    this.setupHTMLConnection();
    this.showCurrentScreen();
  },
  loadExternalLibs: function loadExternalLibs(){
    let script = document.createElement('script');
    script.addEventListener('load', ()=> console.info(`script loaded: ${EXTERNAL_LIB_SCRIPTS[0]}`));
    script.addEventListener('error', ()=> console.info(`script error: ${EXTERNAL_LIB_SCRIPTS[0]}`));
    script.src = EXTERNAL_LIB_SCRIPTS[0];
    document.body.append(script);
  },
  setupServiceWorker: function setupServiceWorker(){
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js', {scope: '/'})
          .then((reg) => {
            console.log('Registration succeeded. Scope is ' + reg.scope);
          }, (error) => {
            console.log('Registration failed with ' + error);
          });
    }
  },
  checkDebugStatus: function checkDebugStatus(){
    this.isDebug = /(\?|&)debug=true/gi.test(location.search);
  },
  setupHTMLConnection: function setupHTMLConnection (){
    let that = this;

    that.htmlElement = document.querySelector('.js-app');

    document.querySelector('#userButton').addEventListener('click', that.HandelModeSelection.bind(that));
    document.querySelector('#businessButton').addEventListener('click', that.HandelModeSelection.bind(that));

    document.querySelector('#generateQrButton').addEventListener('click', that.HandelModeSelection.bind(that));
    document.querySelector('#cancelButton').addEventListener('click', that.HandelModeSelection.bind(that));
    document.querySelector('#editUserDataButton').addEventListener('click', that.HandelModeSelection.bind(that));

    document.querySelectorAll('.js-back-home').forEach(element => element.addEventListener('click', that.HandelModeSelection.bind(that)));

    window.onpopstate = function (event) {
      if (event.state) { 
        that.setMode(event.state.mode, false);
        that.showCurrentScreen();
      }
      console.info(event);
    };
  },
  HandelModeSelection: function HandelModeSelection(event){
    event.preventDefault();
    console.info(event.currentTarget);
    if(event.currentTarget.id === 'userButton') {
      if(this.currentStatus.currentUserData){
        this.setMode(APP_MODES.QR, true);
      } else {
        this.setMode(APP_MODES.USER, true);
      }
      this.showCurrentScreen();
    } else if(event.currentTarget.id === 'businessButton') {
      this.setMode(APP_MODES.BUSINESS, true);
      this.showCurrentScreen();
    } else if(event.currentTarget.id === 'generateQrButton') {
      console.info(document.querySelector('form').checkValidity())
      if(document.querySelector('form').checkValidity()){
        this.setCurrentUserData();
        this.setMode(APP_MODES.QR, true);
        this.showCurrentScreen();
        let helper = {...myApp.currentStatus.currentUserData}
        delete helper.qrCodeDataUrl;
        let helperString = JSON.stringify(helper);
        console.info(helperString, helperString.length);
      }
    }else if(event.currentTarget.id === 'editUserDataButton') {
      this.setMode(APP_MODES.USER, true);
      this.showCurrentScreen();
    }else if(event.currentTarget.id === 'cancelButton') {
      history.back();
    }else if(event.currentTarget.classList.contains('js-back-home')) {
      this.setMode(APP_MODES.START, true);
      this.showCurrentScreen();
    }
  },
  getDateTime: function getDateTime(){
    return (new Date()).toLocaleString("de-at");
  },
  setCurrentUserData: function setCurrentUserData(){
    this.currentStatus.currentUserData = {
      firstname: document.querySelector('#firstname').value,
      lastname: document.querySelector('#lastname').value,
      phoneNumber: document.querySelector('#phoneNumber').value,
      email: document.querySelector('#email').value,
      generateDate: this.getDateTime(),
    };

    this.currentStatus.currentUserData.qrCodeDataUrl = this.generateQRCode(); 
    this.saveCurrentStatus();
  },
  generateQRCode: function generateQRCode(){
      let qrObj = qrcodeWrite( 8, 'L'); //qrcode(14,'M'); // TODO change/optimize for longer/ shorter Data
      qrObj.addData(JSON.stringify(this.currentStatus.currentUserData)),
      qrObj.make();
      return qrObj.createDataURL();
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
    this.currentStatus = savedData;
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

    document.querySelector('#infoButton').classList.remove(CSS_HIDE_CLASS);
  },
  updateCurrentScreen: function updateCurrentScreen(nextScreen){
    
    switch (nextScreen) {
      case APP_MODES.QR:
        this.hideHelpButton(this.currentStatus.currentUserData.qrCodeDataUrl);
        console.info();
        document.querySelector('#qrImage').src = this.currentStatus.currentUserData.qrCodeDataUrl;
        document.querySelector('#fullnameLabel').innerText = 
          `${this.currentStatus.currentUserData.firstname} ${this.currentStatus.currentUserData.lastname.substr(0,1)}.`;
        document.querySelector('#createDateTimeLabel').innerText = 
          `erzeugt: ${this.currentStatus.currentUserData.generateDate}`;
        
        break;
      case APP_MODES.USER:
        let userData = this.currentStatus.currentUserData;
        this.hideHelpButton();
        if (userData){
          document.querySelector('#firstname').value = userData.firstname;
          document.querySelector('#lastname').value = userData.lastname;
          document.querySelector('#phoneNumber').value = userData.phoneNumber;
          document.querySelector('#email').value = userData.email;
          document.querySelector('#currentDate').innerText = this.getDateTime();
        }
        break;
    }
  }, 
  hideHelpButton: function hideHelpButton(){
    document.querySelector('#infoButton').classList.add(CSS_HIDE_CLASS);
  },
  showCurrentScreen: function showCurrentScreen(){
    let nextScreen = APP_MODES.START;
    this.hideAllScreens();

    if(this.currentStatus && this.currentStatus.mode) {
      nextScreen = this.currentStatus.mode;
    }

    this.updateCurrentScreen(nextScreen);
    this.htmlElement.classList.add( CSS_SCREEN_SHOW_BLOCK_PREFIX + nextScreen);
  },
}

window.addEventListener('DOMContentLoaded', myApp.init.bind(myApp));
