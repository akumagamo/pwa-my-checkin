/*

  TODO:
  -> Global refactoring
  ---> Remove Constant - Values into "const" and Top of file


*/


const WEBCAM_BASE_CAPABILITIES = { video: { width: { ideal: 4096 } } };
const WEBCAM_REFRESH_TIMEOUT_MS = 200;
const WEBCAM_QR_DECODE_INTERVAL_MS = 3000; // Performance HIT on Mobile

const WEBCAM_TIMEOUT_MS =  60 * 1000; 

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

let baseStatus = `{"mode": "${APP_MODES.START}"}`;

let myApp = {
  currentStatus: {},
  externalScriptsLoaded: false,
  init: function init(){
    let that = this;
    that.setupServiceWorker()
      .then(that.loadExternalLibs.bind(that))
      .then(that.initWebCams.bind(that))
      .then(function(){
        that.checkDebugStatus();
        that.loadAppState();
        that.setupHTMLConnection();
        that.showCurrentScreen();      
        that.externalScriptsLoaded = true;
      });
  },
  loadExternalLibs: function loadExternalLibs(){
      let promise = Promise.resolve();
      for (let idx = 0; idx < EXTERNAL_LIB_SCRIPTS.length; idx++) {
        promise = promise.then(new Promise(function(innerResolve, innerReject){
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
    return promise;
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
  stopWebCam: function stopWebCam(){
    this.webCamVideo.srcObject.getTracks().forEach(track => {
      track.stop();
    });
    this.webCamObject.scanImage = false;
  },
  initWebCams: function(){
    let dropdown = document.querySelector('#webCamsDropDown');
    let fragment = document.createDocumentFragment();

    return navigator.mediaDevices.enumerateDevices().then(devices => {
        for (let idx in devices) {
          const device = devices[idx];
          let entry = document.createElement('option');
          entry.innerText = device.label;
          entry.value = device.deviceId;
          fragment.append(entry);
      }    
      dropdown.innerHTML = '';
      dropdown.append(fragment);  
    });
  },
  webCamObject: {
    initiated: false,
    renderStartTime: 0,
    lastRefreshTime: 0,
    lastQRDecodeTime: 0,
    scanImage: false,
  },
  updateVideoFeed: function updateVideoFeed(frametime){
    let delta = frametime - this.webCamObject.lastRefreshTime;
    if(this.webCamObject.renderStartTime === 0 ){
      this.webCamObject.renderStartTime = frametime;
    }

    if ( this.webCamObject.initiated && this.webCamObject.scanImage){
      if( delta > WEBCAM_REFRESH_TIMEOUT_MS){
        
        this.webCamObject.lastRefreshTime = frametime;

        console.info(parseInt(this.webCamVideo.videoHeight / 2), this.webCamVideo.videoHeight );
        this.webCamObject.canvas.height = parseInt(this.webCamVideo.videoHeight / 2);
        this.webCamObject.canvas.width = parseInt(this.webCamVideo.videoWidth / 2);
        this.webCamObject.ctx.drawImage(this.webCamVideo, 0, 0, this.webCamObject.canvas.width, this.webCamObject.canvas.height);
        let decodeDelta = frametime - this.webCamObject.lastQRDecodeTime; 
        if(decodeDelta > WEBCAM_QR_DECODE_INTERVAL_MS){
          this.webCamObject.lastQRDecodeTime = frametime;
          Promise.resolve().then(this.tryToDecodeImage);
        }
      }

      let maxRuntimeDelta = frametime - this.webCamObject.renderStartTime;
      if( WEBCAM_TIMEOUT_MS > maxRuntimeDelta){
        requestAnimationFrame(this.updateVideoFeed.bind(this));
      } else {
        this.stopWebCam();
      }
    }
  },
  tryToDecodeImage: function tryToDecodeImage(){
    try {
      qrcodeRead.decode();
    } catch (e) {
      console.info(e);
    }
  },
  initWebCam: function initWebCam(){
    let that = this;
    if (!this.externalScriptsLoaded){
      // TODO Cleanup == Check again
      setTimeout(() => that.initWebCam(), 200);
    } else if ( !this.webCamObject.initiated){
      that.webCamObject.canvas = document.querySelector('#scanCanvas');
      that.webCamObject.ctx = that.webCamObject.canvas.getContext('2d');
      navigator.mediaDevices
        .getUserMedia(WEBCAM_BASE_CAPABILITIES)
        .then(function (stream) {
            that.webCamVideo = document.createElement("video");
            that.webCamVideo.setAttribute("playsinline", true); 
            // TODO CHECK THIS CLAIM required to tell iOS safari we don't want fullscreen
            that.webCamVideo.srcObject = stream;
            that.webCamVideo.play();
            
            that.webCamObject.initiated = true;
            that.webCamObject.scanImage = true;
            requestAnimationFrame(that.updateVideoFeed.bind(that));
        });

      qrcodeRead.callback = function(result) {
        if (result) {
          console.info('Good: ', result);
          that.stopWebCam();
        } else {
          console.info('SCAN No DATA', result);
        }
      };   
    }
  },
  updateWebCam: function updateWebCam(event){
    let that = this;
    let deviceId = event.currentTarget.value;
    return navigator.mediaDevices.getUserMedia({ video:{ deviceId: deviceId, width: { ideal: 4096 }  }}).then(function(stream){
      that.webCamVideo.srcObject = stream;
      that.webCamVideo.play();
      console.info('res', that.webCamVideo.videoWidth, that.webCamVideo.videoHeight) ;    
    });
  },
  setupHTMLConnection: function setupHTMLConnection (){
    let that = this;

    that.htmlElement = document.querySelector('.js-app');

    document.querySelector('#userButton').addEventListener('click', that.handelModeSelection.bind(that));
    document.querySelector('#businessButton').addEventListener('click', that.handelModeSelection.bind(that));

    document.querySelector('#generateQrButton').addEventListener('click', that.handelModeSelection.bind(that));
    document.querySelector('#cancelButton').addEventListener('click', that.handelModeSelection.bind(that));
    document.querySelector('#editUserDataButton').addEventListener('click', that.handelModeSelection.bind(that));

    document.querySelector('#qrImage').addEventListener('error', that.reGenerateQrCode.bind(that));

    document.querySelectorAll('.js-back-home').forEach(element => element.addEventListener('click', that.handelModeSelection.bind(that)));

    document.querySelector('#webCamsDropDown').addEventListener('change', that.updateWebCam.bind(that));;

    window.onpopstate = function (event) {
      if (event.state) { 
        that.setMode(event.state.mode, false);
        that.showCurrentScreen();
      }
      console.info(event);
    };
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
        let helper = {...myApp.currentStatus.currentUserData}
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

    this.currentQRCodeDataUrl = this.generateQRCode(); 
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
        this.hideHelpButton();
        console.info();
        document.querySelector('#qrImage').src = this.currentQRCodeDataUrl;
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
      case APP_MODES.BUSINESS:
          this.initWebCam();
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
