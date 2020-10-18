/*

  TODO:
  -> Global refactoring
  ---> Remove Constant - Values into "const" and Top of file
  
  -> breakup Giant CLASS (eq. HTML, WECAM, SCREENS?! ... )

  -> Debounce all Buttons

*/

const WEBCAM_BASE_CAPABILITIES = { video: { facingMode: { ideal: 'environment' } }};
const WEBCAM_QR_DECODE_INTERVAL_MS = 800;
const WEBCAM_QR_DECODE_TRIES_MAX = 10;

const WEBCAM_QR_SCAN_RESULT_TYPE = {
  ERROR: '-1',
  SUCCESS: '1'
};

const STORAGE_KEY = 'myCheckInStatusData';
const CSS_SCREEN_SHOW_BLOCK_PREFIX = 'app__screen--show-';
const CSS_HIDE_CLASS = 'global__hide'; 

const EXTERNAL_LIB_SCRIPTS = ['js/qrcode-read.min.js','js/qrcode-write.min.js'];

const APP_MODES = {
  START: 'start',
  USER: 'user',
  BUSINESS: 'business', 
  QR: 'qr',
};

const DEFAULT_STATUS_OBJECT = `{"mode": "${APP_MODES.START}"}`;

let myApp = {
  currentStatus: {},
  externalScriptsLoaded: false,
  webCamObject: {
    initiated: false,
    renderStartTime: 0,
    lastRefreshTime: 0,
    lastQRDecodeTime: 0,
    renderVideo: true,
    scanImageForQRCode: false,
    scanTries: 0,
    qrCodeFound: false,
    qrCodeData: {},
  },
  init: function init(){
    let that = this;
    that.setupServiceWorker()
      .then(that.loadExternalLibs.bind(that))
      .then(function(){
        that.externalScriptsLoaded = true;
        that.setupQRCodeReader();
        that.checkDebugStatus();
        that.loadAppState();
        that.setupHTMLConnection();
        that.showCurrentScreen();      
      });
  },
  setupQRCodeReader: function setupQRCodeReader(){
    let that = this;
    qrcodeRead.callback = function(result) {
      if (result) {
        that.webCamObject.qrCodeFound = true;
        that.webCamObject.qrCodeData = JSON.parse(result);
        console.info(JSON.parse(result));
        that.webCamObject.qrCodeData.loadDate = that.getDateTime();
        console.info('Good: ', result);
      } else {
        console.info('Bad SCAN No DATA', result);
      }
    };   
  },
  loadExternalLibs: function loadExternalLibs(){
      let promises = [];
      for (let idx = 0; idx < EXTERNAL_LIB_SCRIPTS.length; idx++) {
        promises.push(new Promise(function(innerResolve, innerReject){
          let scriptUrl = EXTERNAL_LIB_SCRIPTS[idx];
          let script = document.createElement('script');
          script.addEventListener('load', ()=> {
            console.info(`script loaded: ${scriptUrl}`);
            innerResolve();
          });
          script.addEventListener('error', ()=> {
            console.info(`script error: ${scriptUrl}`);
            innerReject();
          });
          script.src = scriptUrl;
          document.body.append(script);          
        }));
      }
      
    return Promise.all(promises);
  },
  setupServiceWorker: function setupServiceWorker(){
    if ('serviceWorker' in navigator) {  
      navigator.serviceWorker.addEventListener('message', function(event){
        console.info('MESSAGE ', event.data);
        if(event && event.data && event.data.reStart){
          this.setMode(APP_MODES.START);
        }
      });

      return navigator.serviceWorker.register('service-worker.js', {scope: '/'})
          .then((reg) => {
            reg.update();
            console.log('Registration succeeded. Scope is ' + reg.scope, reg);
          }, (error) => {
            console.log('Registration failed with ' + error, error);
          });
    
    } 

    return Promise.reject();
  },
  checkDebugStatus: function checkDebugStatus(){
    this.isDebug = /(\?|&)debug=true/gi.test(location.search);
  },
  reGenerateQrCode: function reGenerateQrCode(){
    console.info('ERROR FIX');
    this.currentQRCodeDataUrl = this.generateQRCode();
    document.querySelector('#qrImage').src = this.currentQRCodeDataUrl;
  },
  startWebCam: function startWebCam(){

    let that = this;
    if (!this.externalScriptsLoaded){
      // TODO Cleanup == Check again
      setTimeout(() => that.startWebCam(), 200);
    } else if ( !this.webCamObject.initiated){
      navigator.mediaDevices
        .getUserMedia(WEBCAM_BASE_CAPABILITIES)
        .then(function (stream) {

            that.webCamVideo.srcObject = stream;
            that.webCamVideo.play();
            
            that.webCamObject.qrCodeData = {};
            that.webCamObject.qrCodeFound = false;
            that.webCamObject.initiated = true;
            that.webCamObject.renderVideo = true;
            that.webCamObject.scanImageForQRCode = false;
            that.webCamObject.renderStartTime = 0;
        });
    }
  },
  stopWebCam: function stopWebCam(){
    if(this.webCamVideo.srcObject){
      this.webCamVideo.srcObject.getTracks().forEach(track => {
        track.stop();
      });
    }
    this.webCamObject.scanImageForQRCode = false;
  },
  tryToDecodeImage: function tryToDecodeImage(){
    if(!this.webCamObject.qrCodeFound){
      try {
        qrcodeRead.decode();
      } catch (e) {
        console.info(e);
      }
    }
    return Promise.resolve();
  },
  wait: function wait(milliSeconds){
    return new Promise(function(resolve){
      setTimeout( resolve, milliSeconds);
    });
  },
  showQrScanResult: function showQrScanResult(type, data){
    // TODO VALIDATE DATA
    this.resetScanResult();
     if(type === WEBCAM_QR_SCAN_RESULT_TYPE.SUCCESS){
        document.querySelector('#scanStatusMessage').innerText = 'Daten erfolgreich geladen!';
        document.querySelector('#scanFullnameLabel').innerText = 
        `Name: ${this.generateFullname(data)}`;
          document.querySelector('#scanPhoneNumberLabel').innerText = 
          `Telefon: ${data.phoneNumber}`;
          document.querySelector('#scanDateTimeLabel').innerText = 
        `geladen: ${data.loadDate}`;
     } else {
        document.querySelector('#scanStatusMessage').innerText = 'Kein QR-Code erkannt!';
     }

  },
  resetScanResult: function(){
    document.querySelector('#scanStatusMessage').innerText = '';
    document.querySelector('#scanFullnameLabel').innerText = ''
    document.querySelector('#scanPhoneNumberLabel').innerText = '';
    document.querySelector('#scanDateTimeLabel').innerText = '';
  },
  scanForQRCode: function scanForQRCode(){
    let that = this;
    that.webCamObject.scanTries++;
    if(!that.webCamObject.qrCodeFound && that.webCamObject.scanTries <= WEBCAM_QR_DECODE_TRIES_MAX){
      that.webCamObject.canvas.height = parseInt(that.webCamVideo.videoHeight / 2);
      that.webCamObject.canvas.width = parseInt(that.webCamVideo.videoWidth / 2);
      that.webCamObject.ctx.drawImage(that.webCamVideo, 0, 0, that.webCamObject.canvas.width, that.webCamObject.canvas.height);
      that.tryToDecodeImage()
        .then(that.wait.bind(that, WEBCAM_QR_DECODE_INTERVAL_MS))
        .then(that.scanForQRCode.bind(that));
    } else  {
      let resultType = WEBCAM_QR_SCAN_RESULT_TYPE.ERROR;
      if(that.webCamObject.qrCodeFound){ 
        that.makeVideoFlash();
        resultType = WEBCAM_QR_SCAN_RESULT_TYPE.SUCCESS;
      }
      that.showQrScanResult(resultType, that.webCamObject.qrCodeData);
      that.activeScanButton();
    }
  },
  setupStartScreen: function setupStartScreen(){
    document.querySelector('#userButton').addEventListener('click', this.handelModeSelection.bind(this));
    document.querySelector('#businessButton').addEventListener('click', this.handelModeSelection.bind(this));
  },
  setupUserScreen: function setupStartScreen(){
    document.querySelector('#generateQrButton').addEventListener('click', this.handelModeSelection.bind(this));
    document.querySelector('#cancelButton').addEventListener('click', this.handelModeSelection.bind(this));
  },
  setupQRScreen: function setupStartScreen(){
    document.querySelector('#editUserDataButton').addEventListener('click', this.handelModeSelection.bind(this));
    document.querySelector('#qrImage').addEventListener('error', this.reGenerateQrCode.bind(this));
  },
  setupBusinessScreen: function setupStartScreen(){
    this.webCamVideo = document.querySelector('#scanVideo');
    this.webCamVideo.setAttribute('playsinline', true); // TODO CHECK THIS CLAIM required to tell iOS safari we don't want fullscreen

    this.webCamObject.canvas = document.querySelector('#scanCanvas');
    this.webCamObject.ctx = this.webCamObject.canvas.getContext('2d');

    document.querySelector('#scanButton').addEventListener('click', this.handelModeSelection.bind(this));
    document.querySelector('#backButton').addEventListener('click', this.handelModeSelection.bind(this));
  },
  setupHistory: function setupHistory(){
     window.addEventListener('popstate',  this.handelHistoryPopState.bind(this));  
  },
  setupHTMLConnection: function setupHTMLConnection (){
    let that = this;
    that.htmlElement = document.querySelector('.js-app');
    document.querySelectorAll('.js-back-home').forEach(element => element.addEventListener('click', that.handelModeSelection.bind(that)));

    that.setupStartScreen();
    that.setupUserScreen();
    that.setupBusinessScreen();
    that.setupQRScreen();
    that.setupHistory();
  },
  handelHistoryPopState: function handelHistoryPopState(event){
      if (event.state) { 
        this.setMode(event.state.mode, false);
        this.showCurrentScreen();
      }
      console.info(event);
  },
  deactiveScanButton: function deactiveScanButton(){
    let scanButton = document.querySelector('#scanButton');
    scanButton.disabled = true;
    scanButton.innerText = 'Scanning...';
  },
  activeScanButton: function activeScanButton(){
    let scanButton = document.querySelector('#scanButton');
    scanButton.disabled = false;
    scanButton.innerText = 'Scan';
  },
  makeVideoFlash: function makeVideoFlash(){
    document.querySelector('.app__screen--business-screen__flash-box')
      .classList.add('app__screen--business-screen__flash-box--flash');
      
    console.info('FLASH');
  },
  resetVideoFlash: function makeVideoFlash(){
    document.querySelector('.app__screen--business-screen__flash-box')
      .classList.remove('app__screen--business-screen__flash-box--flash');
  },
  handelModeSelection: function handelModeSelection(event){
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
      }
    } else if(event.currentTarget.id === 'editUserDataButton') {
      this.setMode(APP_MODES.USER, true);
      this.showCurrentScreen();
    } else if(event.currentTarget.id === 'cancelButton') {
      history.back();
    } else if(event.currentTarget.id === 'scanButton') {
      this.webCamObject.scanTries = 0;
      this.webCamObject.qrCodeFound = false;
      this.webCamObject.qrCodeData = {};
      this.resetVideoFlash();
      this.deactiveScanButton();
      Promise.resolve().then(this.scanForQRCode.bind(this));
    } else if(event.currentTarget.id === 'backButton') {
      this.setMode(APP_MODES.START, true);
      this.showCurrentScreen();
    } else if(event.currentTarget.classList.contains('js-back-home')) {
      this.setMode(APP_MODES.START, true);
      this.showCurrentScreen();
    }
  },
  getDateTime: function getDateTime(){
    return (new Date()).toLocaleString('de-at');
  },
  setCurrentUserData: function setCurrentUserData(){
    this.currentStatus.currentUserData = {
      firstname: document.querySelector('#firstname').value,
      lastname: document.querySelector('#lastname').value,
      phoneNumber: document.querySelector('#phoneNumber').value,
      email: document.querySelector('#email').value,
      generateDate: this.getDateTime(),
    };

    this.currentQRCodeDataUrl = this.generateQRCode(); 
  },
  generateQRCode: function generateQRCode(){
      // TODO change/optimize for longer/ shorter Data AND CATCH ERRORS
      let qrObj = qrcodeWrite( 8, 'L'); 
      qrObj.addData(JSON.stringify(this.currentStatus.currentUserData)),
      qrObj.make();
      return qrObj.createDataURL();
  },
  setMode: function setMode(newMode, addToHistory){
    if(addToHistory){
      window.history.pushState(this.currentStatus, null, '');
    }
    this.currentStatus.mode = newMode;
    this.saveCurrentStatus();
  },
  saveCurrentStatus: function saveCurrentStatus(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentStatus));
  },
  loadAppState: function loadAppState(){
    let savedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || DEFAULT_STATUS_OBJECT);
    this.currentStatus = savedData;
    window.history.replaceState(this.currentStatus, null, '');
    console.info(this.currentStatus);
  },
  resetAppScreens: function resetAppScreens(){
    this.htmlElement.classList.remove(
      CSS_SCREEN_SHOW_BLOCK_PREFIX + APP_MODES.START,
      CSS_SCREEN_SHOW_BLOCK_PREFIX + APP_MODES.USER,
      CSS_SCREEN_SHOW_BLOCK_PREFIX + APP_MODES.BUSINESS,
      CSS_SCREEN_SHOW_BLOCK_PREFIX + APP_MODES.QR,
    );

    this.showHelpButton();
    this.activeScanButton();
    this.resetVideoFlash();
    this.resetScanResult();
  },
  generateFullname: function(data){
    return `${data.firstname} ${data.lastname.substr(0,1)}.`;
  },
  updateCurrentScreen: function updateCurrentScreen(nextScreen){
    
    switch (nextScreen) {
      case APP_MODES.QR:
        this.hideHelpButton();
        console.info();
        document.querySelector('#qrImage').src = this.currentQRCodeDataUrl;
        document.querySelector('#fullnameLabel').innerText = 
          this.generateFullname(this.currentStatus.currentUserData);
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
      case APP_MODES.BUSINESS:
          this.hideHelpButton();
          this.startWebCam();
        break;
    }
  }, 
  hideHelpButton: function hideHelpButton(){
    document.querySelector('#infoButton').classList.add(CSS_HIDE_CLASS);
  },
  showHelpButton: function hideHelpButton(){
    document.querySelector('#infoButton').classList.remove(CSS_HIDE_CLASS);
  },
  showCurrentScreen: function showCurrentScreen(){
    let nextScreen = APP_MODES.START;
    this.resetAppScreens();
    this.stopWebCam();

    if(this.currentStatus && this.currentStatus.mode) {
      nextScreen = this.currentStatus.mode;
    }

    this.updateCurrentScreen(nextScreen);
    this.htmlElement.classList.add( CSS_SCREEN_SHOW_BLOCK_PREFIX + nextScreen);
  },
}

window.addEventListener('DOMContentLoaded', myApp.init.bind(myApp));
