// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBB2GyLO7VRaX1uVjZa9AmLo_oC9MrFEsA",
    authDomain: "bmiiii-a1b3c.firebaseapp.com",
    projectId: "bmiiii-a1b3c",
    storageBucket: "bmiiii-a1b3c.firebasestorage.app",
    messagingSenderId: "380271882255",
    appId: "1:380271882255:web:e2a4873532c97134d4f37a",
    measurementId: "G-S7HBTPR21D"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
let app = null;
let auth = null;
let db = null;
let isAuthReady = false;
let userId = 'guest'; // Default to guest

try {
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        const analytics = getAnalytics(app);
        auth = getAuth(app);
        db = getFirestore(app);
        
        // This is the core listener that handles authentication state
        onAuthStateChanged(auth, (user) => {
            isAuthReady = true;
            if (user) {
                userId = user.uid;
                console.log("User is authenticated. User ID:", userId);
                
                // ถ้าอยู่ในหน้า index2.html ให้เรียกฟังก์ชันดึงข้อมูลผู้ใช้มาแสดง
                if (window.location.pathname.endsWith('index2.html')) {
                    loadUserData();
                }
            } else {
                userId = null;
                console.log("No user is signed in.");
            }
            showLoading(false);
        });

        if (initialAuthToken) {
            signInWithCustomToken(auth, initialAuthToken).catch((error) => {
                console.error("Error signing in with custom token:", error);
                signInAnonymously(auth);
            });
        } else {
            signInAnonymously(auth);
        }
    } else {
        console.error("Firebase config is missing API key. Firebase will not be initialized.");
    }
} catch (e) {
    console.error("Firebase initialization failed:", e);
}

// --- JavaScript Logic ---
let photoData = null;

// Check login form validity (Now it always enables the button)
window.checkLoginForm = function() {
    const loginBtn = document.getElementById('loginBtn');
    
    loginBtn.disabled = false;
    loginBtn.classList.remove('btn-disabled');
}
window.saveUserData = async function(dataToUpdate) {
            if (!auth.currentUser || !db) {
                console.error("User not authenticated or Firestore not initialized.");
                return;
            }

            const userId = auth.currentUser.uid;
            const userDocRef = doc(db, 'artifacts', 'default-app-id', 'users', userId, 'registration_data', 'profile');

            try {
                await updateDoc(userDocRef, dataToUpdate);
                console.log("User data successfully updated!");
            } catch (error) {
                console.error("Error updating user data:", error);
                // showNotification('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
            }
        };

        onAuthStateChanged(auth, (user) => {
    isAuthReady = true;
    if (user) {
        userId = user.uid;
        console.log("User is authenticated. User ID:", userId);
        
        // Only load user data if on the protected page (index2.html)
        if (window.location.pathname.endsWith('index2.html')) {
            loadUserData();
        }
    } else {
        userId = null;
        console.log("No user is signed in.");
        
        // Only redirect to login if user is on a protected page
        // Protected pages are any page that's NOT index.html
        const currentPath = window.location.pathname;
        const isOnLoginPage = currentPath.endsWith('index.html') || currentPath === '/';
        
        if (!isOnLoginPage) {
            // User is not authenticated and on a protected page
            showNotification('เซสชันหมดอายุ', 'warning', 'กำลังนำคุณไปยังหน้าเข้าสู่ระบบ');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    }
    showLoading(false);
});
// Login function
window.login = function() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showNotification('กรุณากรอกอีเมลและรหัสผ่าน', 'error', 'ไม่สามารถเข้าสู่ระบบได้หากข้อมูลไม่ครบ');
        return;
    }

    if (!isAuthReady) {
        showNotification('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error', 'ไม่สามารถเข้าสู่ระบบได้ โปรดลองอีกครั้ง');
        return;
    }

    showLoading(true);

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            showLoading(false);
            showNotification('เข้าสู่ระบบสำเร็จ', 'success');
            window.location.href = 'index2.html';
        })
        .catch((error) => {
            showLoading(false);
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error(errorCode, errorMessage);
            if (errorCode === 'auth/invalid-email' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
                showNotification('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error', 'โปรดตรวจสอบข้อมูลอีกครั้ง');
            } else {
                showNotification('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error', 'โปรดลองอีกครั้ง');
            }
        });
};

// Change page
window.goToPage1 = function() {
    document.getElementById('page1').classList.remove('hidden');
    document.getElementById('page2').classList.add('hidden');
    clearForm();
}

window.goToPage2 = function() {
    document.getElementById('page1').classList.add('hidden');
    document.getElementById('page2').classList.remove('hidden');
    document.getElementById('page2').classList.add('slide-in-right');
}

// Take photo
window.takePhoto = function() {
    document.getElementById('photoInput').click();
}

window.handlePhotoSelect = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
        showNotification('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
        return;
    }
    
    // Check original file size (limit to 10MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
        showNotification('ไฟล์รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 10MB)', 'error');
        return;
    }
    
    // Show loading state
    showLoading(true);
    showNotification('กำลังประมวลผลรูปภาพ...', 'info');
    
    try {
        // First compression attempt with standard settings
        let compressedDataUrl = await compressImage(file, 800, 600, 0.8);
        let fileSizeKB = getFileSizeKB(compressedDataUrl);
        
        // If still too large, apply more aggressive compression
        if (fileSizeKB > 500) { // 500KB threshold
            compressedDataUrl = await compressImage(file, 600, 450, 0.6);
            fileSizeKB = getFileSizeKB(compressedDataUrl);
            
            // Final compression attempt if still too large
            if (fileSizeKB > 300) { // 300KB threshold
                compressedDataUrl = await compressImage(file, 400, 300, 0.5);
                fileSizeKB = getFileSizeKB(compressedDataUrl);
            }
        }
        
        // Set compressed image data
        photoData = compressedDataUrl;
        
        // Update UI
        const preview = document.getElementById('photoPreview');
        const placeholder = document.getElementById('cameraPlaceholder');
        const overlay = document.getElementById('photoOverlay');
        
        preview.src = photoData;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        overlay.classList.remove('hidden');
        
        // Hide loading and show success
        showLoading(false);
        showNotification(`รูปภาพถูกประมวลผลแล้ว (ขนาด: ${fileSizeKB} KB)`, 'success');
        
        updateProgress();
        
    } catch (error) {
        console.error('Error compressing image:', error);
        showLoading(false);
        showNotification('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ', 'error');
    }
}

// Check password strength
window.checkPasswordStrength = function() {
    const password = document.getElementById('password').value;
    const strengthMeter = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    if (password.length === 0) {
        strengthMeter.classList.add('hidden');
        return;
    }
    strengthMeter.classList.remove('hidden');
    let strength = 0;
    let feedback = [];
    if (password.length >= 8) strength += 25;
    else feedback.push('ต้องมีอย่างน้อย 8 ตัวอักษร');
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    else feedback.push('ต้องมีตัวพิมพ์เล็กและใหญ่');
    if (/\d/.test(password)) strength += 25;
    else feedback.push('ต้องมีตัวเลข');
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 25;
    else feedback.push('ต้องมีอักขระพิเศษ');
    strengthFill.style.width = strength + '%';
    if (strength < 50) {
        strengthFill.style.background = '#ef4444';
        strengthText.textContent = 'รหัสผ่านอ่อน: ' + feedback.join(', ');
        strengthText.className = 'text-xs mt-1 text-red-500';
    } else if (strength < 75) {
        strengthFill.style.background = '#f59e0b';
        strengthText.textContent = 'รหัสผ่านปานกลาง';
        strengthText.className = 'text-xs mt-1 text-yellow-500';
    } else {
        strengthFill.style.background = '#10b981';
        strengthText.textContent = 'รหัสผ่านแข็งแกร่ง';
        strengthText.className = 'text-xs mt-1 text-green-500';
    }
    updateProgress();
}

// Calculate BMI
window.calculateBMI = function() {
    const weight = parseFloat(document.getElementById('weight').value);
    const height = parseFloat(document.getElementById('height').value) / 100;
    if (weight && height && weight > 0 && height > 0) {
        const bmi = weight / (height * height);
        const bmiResult = document.getElementById('bmiResult');
        const bmiValue = document.getElementById('bmiValue');
        const bmiCategory = document.getElementById('bmiCategory');
        const bmiIcon = document.getElementById('bmiIcon');
        const bmiIndicator = document.getElementById('bmiIndicator');
        const bmiAdvice = document.getElementById('bmiAdvice');
        bmiValue.textContent = bmi.toFixed(1);
        let category, color, iconBg, advice, indicatorPosition;
        if (bmi < 18.5) {
            category = 'น้ำหนักน้อย';
            color = 'text-blue-600';
            iconBg = 'bg-blue-400';
            advice = '🍎 ควรเพิ่มน้ำหนักด้วยการรับประทานอาหารที่มีประโยชน์และออกกำลังกายเพื่อเสริมสร้างกล้ามเนื้อ';
            indicatorPosition = Math.max(0, (bmi / 18.5) * 25);
        } else if (bmi < 25) {
            category = 'น้ำหนักปกติ';
            color = 'text-green-600';
            iconBg = 'bg-green-400';
            advice = '✨ ยอดเยี่ยม! น้ำหนักของคุณอยู่ในเกณฑ์ที่เหมาะสม ควรรักษาระดับนี้ด้วยการออกกำลังกายสม่ำเสมอ';
            indicatorPosition = 25 + ((bmi - 18.5) / (25 - 18.5)) * 25;
        } else if (bmi < 30) {
            category = 'น้ำหนักเกิน';
            color = 'text-yellow-600';
            iconBg = 'bg-yellow-400';
            advice = '⚠️ ควรควบคุมน้ำหนักด้วยการลดปริมาณอาหารและเพิ่มการออกกำลังกาย อย่างน้อย 150 นาทีต่อสัปดาห์';
            indicatorPosition = 50 + ((bmi - 25) / (30 - 25)) * 25;
        } else {
            category = 'อ้วน';
            color = 'text-red-600';
            iconBg = 'bg-red-400';
            advice = '🏥 ควรปรึกษาแพทย์เพื่อวางแผนลดน้ำหนักอย่างปลอดภัย และควบคุมอาหารอย่างเข้มงวด';
            indicatorPosition = Math.min(100, 75 + ((bmi - 30) / 10) * 25);
        }
        bmiCategory.textContent = category;
        bmiCategory.className = `font-medium ${color}`;
        bmiIcon.className = `w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${iconBg}`;
        bmiIcon.textContent = bmi < 18.5 ? '📉' : bmi < 25 ? '✅' : bmi < 30 ? '⚠️' : '🚨';
        bmiAdvice.textContent = advice;
        bmiIndicator.style.left = `${indicatorPosition}%`;
        bmiResult.classList.remove('hidden');
        bmiResult.style.animation = 'none';
        setTimeout(() => {
            bmiResult.style.animation = 'fadeIn 0.5s ease-out';
        }, 10);
    } else if (document.getElementById('weight').value || document.getElementById('height').value) {
        document.getElementById('bmiResult').classList.add('hidden');
    }
}

// Show BMI info
window.showBMIInfo = function() {
    document.getElementById('bmiInfoModal').classList.remove('hidden');
}

// Close BMI info
window.closeBMIInfo = function() {
    document.getElementById('bmiInfoModal').classList.add('hidden');
}

// Update progress bar
function updateProgress() {
    const requiredFields = [
        'email', 'password', 'phone', 'firstName', 
        'lastName', 'birthDate', 'gender', 'weight', 'height', 
        'department', 'organization'
    ];
    let filledFields = 0;
    let totalFields = requiredFields.length + 1; // +1 for photo
    for (let field of requiredFields) {
        const value = document.getElementById(field).value.trim();
        if (value) filledFields++;
    }
    if (photoData) filledFields++;
    const progress = Math.round((filledFields / totalFields) * 100);
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progressText').textContent = progress + '%';

    const submitBtn = document.getElementById('submitBtn');
    if (photoData) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-disabled');
    } else {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-disabled');
    }
    
    return progress;
}

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Listener for registration form inputs
    const inputs = document.querySelectorAll('#registrationForm input, #registrationForm select');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            updateProgress();
            if (input.id === 'weight' || input.id === 'height') {
                calculateBMI();
            }
        });
        input.addEventListener('change', updateProgress);
    });

    // Listener for login form inputs
    const loginInputs = document.querySelectorAll('#loginEmail, #loginPassword');
    loginInputs.forEach(input => {
        input.addEventListener('input', checkLoginForm);
    });

    // Listener for registration form submission
    document.getElementById('registrationForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitForm();
    });

    // Listener for login button click
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', login);
    }
    
    // Also, handle form submission when user presses Enter
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            login();
        });
    }

    // Ensure the login button is enabled as soon as the page loads
    checkLoginForm();
});

// Submit form to Firebase Authentication
async function submitForm() {
    if (!isAuthReady) {
        showNotification('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error', 'ไม่สามารถลงทะเบียนได้ โปรดลองอีกครั้ง');
        return;
    }

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
        showNotification('โปรดแก้ไขข้อมูลที่ผิดพลาด', 'error', validationErrors.join('<br>'));
        return;
    }

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    showLoading(true);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const currentUserId = user.uid;

        const weight = parseFloat(document.getElementById('weight').value);
        const height = parseFloat(document.getElementById('height').value);
        const bmi = parseFloat((weight / (height / 100)**2).toFixed(1));

        const userData = {
            email: email,
            phone: document.getElementById('phone').value.trim(),
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            birthDate: document.getElementById('birthDate').value,
            gender: document.getElementById('gender').value,
            weight: weight,
            height: height,
            department: document.getElementById('department').value.trim(),
            organization: document.getElementById('organization').value.trim(),
            photo: photoData,
            bmi: bmi,
            healthPoints: 10,
            level: 0,
            exp: 10,
            experiencePoints: 10,
            consecutiveDays: 0,
            timestamp: new Date()
        };
        
        if (db) {
            const userDocRef = doc(db, 'artifacts', appId, 'users', currentUserId, 'registration_data', 'profile');
            await setDoc(userDocRef, userData);
        }

        showLoading(false);
        showSuccessModal();

    } catch (error) {
        showLoading(false);
        let errorMessage = "เกิดข้อผิดพลาดในการลงทะเบียน";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "อีเมลนี้ถูกใช้แล้ว";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "รหัสผ่านอ่อนเกินไป (ควรมีอย่างน้อย 6 ตัวอักษร)";
        } else {
            errorMessage = `ข้อผิดพลาด: ${error.message}`;
        }
        showNotification('การลงทะเบียนล้มเหลว', 'error', errorMessage);
        console.error("Error creating user or saving to Firestore:", error);
    }
}

// Validate form data
function validateForm() {
    const errors = [];
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const weight = parseFloat(document.getElementById('weight').value);
    const height = parseFloat(document.getElementById('height').value);
    const password = document.getElementById('password').value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errors.push('❌ รูปแบบอีเมลไม่ถูกต้อง');
    }
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
        errors.push('❌ เบอร์โทรศัพท์ไม่ถูกต้อง (10 หลัก)');
    }
    if (password.length < 6) {
        errors.push('❌ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }
    if (weight <= 0 || weight > 300) {
        errors.push('❌ น้ำหนักไม่ถูกต้อง (1-300 กิโลกรัม)');
    }
    if (height <= 0 || height > 250) {
        errors.push('❌ ส่วนสูงไม่ถูกต้อง (1-250 เซนติเมตร)');
    }
    if (!photoData) {
        errors.push('❌ กรุณาถ่ายรูป');
    }
    if (document.getElementById('firstName').value.trim() === '') {
        errors.push('❌ กรุณากรอกชื่อ');
    }
    if (document.getElementById('lastName').value.trim() === '') {
        errors.push('❌ กรุณากรอกนามสกุล');
    }
    if (document.getElementById('birthDate').value === '') {
        errors.push('❌ กรุณาเลือกวันเกิด');
    }
    if (document.getElementById('gender').value === '') {
        errors.push('❌ กรุณาเลือกเพศ');
    }
    if (document.getElementById('department').value.trim() === '') {
        errors.push('❌ กรุณากรอกแผนก');
    }
    if (document.getElementById('organization').value.trim() === '') {
        errors.push('❌ กรุณากรอกองค์กร');
    }

    return errors;
}

// Show notification
function showNotification(message, type = 'error', subtext = '') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    const notificationSubtext = document.getElementById('notificationSubtext');
    const notificationDiv = notification.querySelector('div');
    
    if (Array.isArray(subtext)) {
        subtext = subtext.join('<br>');
    }
    
    notificationText.textContent = message;
    notificationSubtext.innerHTML = subtext;
    
    notificationDiv.className = 'px-6 py-4 rounded-xl shadow-2xl flex flex-col items-start space-y-1';
    const icon = notificationDiv.querySelector('i');
    if (type === 'success') {
        notificationDiv.classList.add('bg-green-500', 'text-white');
        icon.className = 'fas fa-check-circle text-xl';
    } else if (type === 'info') {
        notificationDiv.classList.add('bg-blue-500', 'text-white');
        icon.className = 'fas fa-info-circle text-xl';
    } else if (type === 'warning') {
        notificationDiv.classList.add('bg-yellow-500', 'text-white');
        icon.className = 'fas fa-exclamation-triangle text-xl';
    } else {
        notificationDiv.classList.add('bg-red-500', 'text-white');
        icon.className = 'fas fa-exclamation-circle text-xl';
    }
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 8000);
}

// Show/hide loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// Show success modal
function showSuccessModal() {
    document.getElementById('successModal').classList.remove('hidden');
}

window.closeSuccessModal = function() {
    document.getElementById('successModal').classList.add('hidden');
    goToPage1();
}

// Clear form
function clearForm() {
    document.getElementById('registrationForm').reset();
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    photoData = null;
    document.getElementById('photoPreview').classList.add('hidden');
    document.getElementById('cameraPlaceholder').classList.remove('hidden');
    document.getElementById('photoOverlay').classList.add('hidden');
    document.getElementById('bmiResult').classList.add('hidden');
    document.getElementById('passwordStrength').classList.add('hidden');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';
    checkLoginForm();
    updateProgress();
}

// Handle Logout
window.logout = function() {
    // Check if Firebase auth is ready
    if (!isAuthReady) {
        showNotification('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error', 'ไม่สามารถออกจากระบบได้ โปรดลองอีกครั้ง');
        return;
    }

    // Show confirmation dialog before logging out
    const confirmLogout = confirm('คุณต้องการออกจากระบบหรือไม่?');
    if (!confirmLogout) {
        return;
    }

    // Show loading state
    showLoading(true);

    signOut(auth).then(() => {
        // Clear any local data/cache
        clearLocalData();
        
        // Hide loading state
        showLoading(false);
        
        // Show success notification
        showNotification('ออกจากระบบเรียบร้อยแล้ว', 'success');
        
        // Redirect to login page after a short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    }).catch((error) => {
        // Hide loading state on error
        showLoading(false);
        
        console.error("Error signing out:", error);
        
        // Show error notification with specific error handling
        let errorMessage = 'เกิดข้อผิดพลาดในการออกจากระบบ';
        
        if (error.code === 'auth/network-request-failed') {
            errorMessage = 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'มีการพยายามออกจากระบบมากเกินไป โปรดรอสักครู่';
        }
        
        showNotification(errorMessage, 'error', 'โปรดลองอีกครั้งในภายหลัง');
        
        // Force redirect to login page even if logout fails
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    });
};

// Helper function to clear local data
function clearLocalData() {
    // Reset global variables
    photoData = null;
    userId = 'guest';
    
    // Clear any form data
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        if (form.reset) {
            form.reset();
        }
    });
    
    // Clear any cached UI elements
    const elementsToReset = [
        'userName', 'bmiResult', 'userLevel', 'totalPoints', 
        'healthPoints', 'consecutiveDays', 'exerciseStatus'
    ];
    
    elementsToReset.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = '';
        }
    });
    
    // Hide profile photos and show default placeholders
    const profilePhoto = document.getElementById('profilePhoto');
    const profileSvg = document.getElementById('profileSvg');
    if (profilePhoto && profileSvg) {
        profilePhoto.classList.add('hidden');
        profileSvg.classList.remove('hidden');
    }
    
    console.log('Local data cleared');
}

// Alternative logout function with more robust error handling
window.logoutWithRetry = function(retryCount = 0) {
    const maxRetries = 3;
    
    if (!isAuthReady) {
        showNotification('ระบบยังไม่พร้อม', 'warning', 'โปรดรอสักครู่แล้วลองใหม่');
        return;
    }

    if (retryCount === 0) {
        const confirmLogout = confirm('คุณต้องการออกจากระบบหรือไม่?');
        if (!confirmLogout) {
            return;
        }
        showLoading(true);
    }

    signOut(auth).then(() => {
        clearLocalData();
        showLoading(false);
        showNotification('ออกจากระบบเรียบร้อยแล้ว', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    }).catch((error) => {
        console.error(`Logout attempt ${retryCount + 1} failed:`, error);
        
        if (retryCount < maxRetries) {
            // Retry after a short delay
            setTimeout(() => {
                logoutWithRetry(retryCount + 1);
            }, 1000 * (retryCount + 1)); // Exponential backoff
            
            showNotification(`กำลังลองใหม่... (ครั้งที่ ${retryCount + 2})`, 'info');
        } else {
            // Max retries reached, force redirect
            showLoading(false);
            showNotification('ไม่สามารถออกจากระบบได้', 'error', 'จะนำคุณไปยังหน้าเข้าสู่ระบบ');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    });
};

// Quick logout function (no confirmation)
window.quickLogout = function() {
    if (!isAuthReady) {
        window.location.href = 'index.html';
        return;
    }

    signOut(auth).then(() => {
        clearLocalData();
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Quick logout error:", error);
        // Force redirect even on error
        window.location.href = 'index.html';
    });
};

// Automatic logout on authentication state change
if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (!user && window.location.pathname.includes('index2.html')) {
            // User is not authenticated and on a protected page
            showNotification('เซสชันหมดอายุ', 'warning', 'กำลังนำคุณไปยังหน้าเข้าสู่ระบบ');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    });
}

// Load user data from Firestore
async function loadUserData() {
    if (auth && auth.currentUser && db && document.getElementById('mainContent')) {
        const userId = auth.currentUser.uid;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'registration_data', 'profile');
        
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const userData = docSnap.data();
                console.log("User data loaded:", userData);

                // Update the UI with fetched data
                document.getElementById('userName').textContent = `${userData.firstName} ${userData.lastName}`;
                document.getElementById('bmiResult').textContent = userData.bmi;
                 document.getElementById('userLevel').textContent = userData.level; 
                document.getElementById('totalPoints').textContent = userData.healthPoints;
                document.getElementById('healthPoints').textContent = userData.healthPoints;
                document.getElementById('consecutiveDays').textContent = userData.consecutiveDays;
                renderLevelStars('levelStarsMain', userData.level || 0); // สำหรับหน้าหลัก
                renderLevelStars('levelStarsPopup', userData.level || 0); // สำหรับ popup
                // Update BMI status based on the loaded dataconst profilePicElement = document.getElementById('userProfilePicture');
   
                const bmiStatus = document.getElementById('bmiStatus');
                if (userData.bmi < 18.5) {
                    bmiStatus.textContent = 'น้ำหนักน้อย';
                    bmiStatus.className = 'text-xs text-blue-200';
                } else if (userData.bmi < 25) {
                    bmiStatus.textContent = 'น้ำหนักปกติ';
                    bmiStatus.className = 'text-xs text-green-200';
                } else if (userData.bmi < 30) {
                    bmiStatus.textContent = 'น้ำหนักเกิน';
                    bmiStatus.className = 'text-xs text-yellow-200';
                } else {
                    bmiStatus.textContent = 'อ้วน';
                    bmiStatus.className = 'text-xs text-red-200';
                }
                
                // NEW: Update profile photo
                const profilePhoto = document.getElementById('profilePhoto');
                const profileSvg = document.getElementById('profileSvg');
                if (userData.photo) {
                    profilePhoto.src = userData.photo;
                    profilePhoto.classList.remove('hidden');
                    profileSvg.classList.add('hidden');
                } else {
                    profilePhoto.classList.add('hidden');
                    profileSvg.classList.remove('hidden');
                }
                const levelProfilePhoto = document.getElementById('levelProfilePhoto');
                const levelProfileSvg = document.getElementById('levelProfileSvg');

                if (userData.photo) {
                    levelProfilePhoto.src = userData.photo;
                    levelProfilePhoto.classList.remove('hidden');
                    levelProfileSvg.classList.add('hidden');
                } else {
                    levelProfilePhoto.classList.add('hidden');
                    levelProfileSvg.classList.remove('hidden');
                }
                // Show main content
                document.getElementById('mainContent').classList.remove('hidden');

            } else {
                console.log("No such document!");
                showNotification('ไม่พบข้อมูลผู้ใช้', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        } catch (error) {
            console.error("Error getting user data:", error);
            showNotification('เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
        }
    }
    if (window.checkSubmissionStatus) {
    window.checkSubmissionStatus();
    }
}
function renderLevelStars(containerId, level) {
    const container = document.getElementById(containerId);
    if (!container) return; // Exit if container doesn't exist
    
    container.innerHTML = ''; // Clear existing stars
    const maxStars = 5;
    
    for (let i = 1; i <= maxStars; i++) {
        const starSpan = document.createElement('span');
        starSpan.textContent = '★';
        
        if (i <= level) {
            starSpan.className = 'text-2xl text-yellow-400'; // Filled star
        } else {
            starSpan.className = 'text-2xl text-gray-400'; // Empty star
        }
        
        if (containerId === 'levelStarsPopup') {
            starSpan.classList.add('text-xl'); // Use a smaller size for the popup
        }
        
        container.appendChild(starSpan);
    }
}
async function saveUserData(dataToUpdate) {
    if (!auth.currentUser || !db) {
        console.error("User not authenticated or Firestore not initialized.");
        return;
    }

    const userId = auth.currentUser.uid;
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'registration_data', 'profile');

    try {
        await updateDoc(userDocRef, dataToUpdate);
        console.log("User data successfully updated!");
    } catch (error) {
        console.error("Error updating user data:", error);
        showNotification('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
}
function compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // Calculate new dimensions while maintaining aspect ratio
            let { width, height } = img;
            
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            
            // Set canvas dimensions
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to blob with compression
            canvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(blob);
            }, 'image/jpeg', quality);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Function to get file size in KB
function getFileSizeKB(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const bytes = (base64.length * 3) / 4;
    return Math.round(bytes / 1024);
}
