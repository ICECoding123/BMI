// Import Firebase functions
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Initialize Firebase references
const auth = getAuth();
const db = getFirestore();
const appId = 'default-app-id'; // Make sure this matches your app ID

// Google Apps Script Web App URL - เปลี่ยนเป็น URL ของ Google Apps Script ของคุณ
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzzwn1o6WGvrWQoiiQbvKb4GXdLeOEvIGYRcY7Nl7BVNdt6yi_2YPBZYjNUGMqYN0IiNg/exec';

// Exercise Time Update
function updateExerciseTime(value) {
    document.getElementById('currentTime').textContent = value;
    const runner = document.querySelector('.runner-animation');
    const percentage = (value / 60) * 100;
    runner.style.left = percentage + '%';
    
    const progressBar = runner.previousElementSibling;
    progressBar.style.width = percentage + '%';
}

// Photo Functions
function takePhoto() {
    // Check if user can submit today before allowing photo capture
    checkDailySubmissionLimit().then(canSubmit => {
        alert('เปิดกล้องถ่ายภาพ (ฟีเจอร์นี้ต้องการการเชื่อมต่อกับกล้อง)');
    });
}

function uploadPhoto() {
    // Check if user can submit today before allowing photo upload
    checkDailySubmissionLimit().then(canSubmit => {
        document.getElementById('photoInput').click();
    });
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
        // Double-check submission limit before processing the photo
        checkDailySubmissionLimit().then(canSubmit => {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('previewImage').src = e.target.result;
                document.getElementById('photoPreview').classList.remove('hidden');
                document.getElementById('uploadPlaceholder').classList.add('hidden');
                showNotification('อัพโหลดภาพสำเร็จ!', 'success', 'พร้อมส่งข้อมูลเข้าระบบแล้ว');
            };
            reader.readAsDataURL(file);
        });
    } else {
        showNotification('กรุณาเลือกไฟล์ .jpg หรือ .png เท่านั้น', 'error');
    }
}

// Check if user can submit today
async function checkDailySubmissionLimit() {
    try {
        if (!auth.currentUser || !db) {
            console.warn('Auth or DB not available');
            return false;
        }

        const userId = auth.currentUser.uid;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'registration_data', 'profile');
        
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const lastSubmissionDate = userData.lastExerciseDate;
            const today = new Date().toISOString().split('T')[0];
            
            console.log('Last submission:', lastSubmissionDate, 'Today:', today);
            
            // Return false if already submitted today, true if can submit
            return lastSubmissionDate !== today;
        }
        
        console.log('No existing data, allowing submission');
        return true; // If no data exists, allow submission
        
    } catch (error) {
        console.error("Error checking submission limit:", error);
        // ในกรณี error ให้อนุญาตส่งได้ แต่ log ไว้
        return true;
    }
}

// Level Popup Functions
function showLevelPopup() {
    document.getElementById('levelPopup').classList.remove('hidden');
}

function closeLevelPopup() {
    document.getElementById('levelPopup').classList.add('hidden');
}

function showExpInfo() {
    document.getElementById('levelPopup').classList.add('hidden');
    document.getElementById('expInfoPopup').classList.remove('hidden');
}

function closeExpInfo() {
    document.getElementById('expInfoPopup').classList.add('hidden');
}

// Save user data to Firestore
async function saveUserData(dataToUpdate) {
    if (!auth.currentUser || !db) {
        console.error("User not authenticated or Firestore not initialized.");
        throw new Error("User not authenticated");
    }

    const userId = auth.currentUser.uid;
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'registration_data', 'profile');

    try {
        await updateDoc(userDocRef, {
            ...dataToUpdate,
            lastUpdated: new Date() // Add timestamp
        });
        console.log("User data successfully updated!", dataToUpdate);
        return true;
    } catch (error) {
        console.error("Error updating user data:", error);
        throw error;
    }
}

// Send data to Google Sheets
async function sendToGoogleSheets(data, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds
    
    try {
        console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES + 1} - Sending to Google Sheets:`, data);
        
        // สร้าง AbortController สำหรับ timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('Request timeout - aborting');
            controller.abort();
        }, 20000); // ลด timeout เป็น 20 วินาที

        // ตรวจสอบ URL ก่อน
        if (!GOOGLE_APPS_SCRIPT_URL || !GOOGLE_APPS_SCRIPT_URL.startsWith('https://script.google.com')) {
            throw new Error('Google Apps Script URL ไม่ถูกต้อง');
        }

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            mode: 'cors', // เพิ่ม CORS mode
            cache: 'no-cache', // ไม่ใช้ cache
            signal: controller.signal
        };

        console.log('Fetch options:', fetchOptions);
        console.log('Sending to URL:', GOOGLE_APPS_SCRIPT_URL);

        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, fetchOptions);
        
        clearTimeout(timeoutId);
        
        console.log('Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            url: response.url,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // อ่าน response
        const responseText = await response.text();
        console.log('Response body:', responseText);
        
        // พยายาม parse JSON
        let result;
        try {
            result = JSON.parse(responseText);
            console.log('Parsed response:', result);
        } catch (parseError) {
            console.warn('Non-JSON response:', parseError.message);
            // ถ้า response มี HTML หรือ redirect message
            if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
                throw new Error('Google Apps Script ส่งกลับ HTML แทน JSON (อาจเป็น error page)');
            }
            // ถือว่าสำเร็จถ้า status OK
            return {
                success: true,
                message: 'Data sent successfully',
                rawResponse: responseText.substring(0, 200) // เก็บแค่ส่วนแรก
            };
        }
        
        // ตรวจสอบผลลัพธ์
        if (result && (result.success === true || result.success === 'true')) {
            console.log('✅ Google Sheets success:', result);
            return result;
        } else if (result && result.error) {
            throw new Error(`Google Apps Script Error: ${result.error}`);
        } else {
            throw new Error(result?.message || 'Unknown response from Google Apps Script');
        }
        
    } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        
        // จำแนกประเภท error
        let shouldRetry = false;
        let errorMessage = error.message;

        if (error.name === 'AbortError') {
            errorMessage = 'เชื่อมต่อใช้เวลานานเกินไป (timeout)';
            shouldRetry = true;
        } else if (error.name === 'TypeError') {
            if (error.message.includes('fetch')) {
                errorMessage = 'ไม่สามารถเชื่อมต่อได้ (Network Error)';
                shouldRetry = true;
            } else if (error.message.includes('NetworkError')) {
                errorMessage = 'ปัญหาเครือข่าย กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
                shouldRetry = true;
            }
        } else if (error.message.includes('HTTP 4')) {
            errorMessage = 'Google Apps Script ไม่อนุญาตให้เข้าถึง (สิทธิ์ไม่เพียงพอ)';
            shouldRetry = false; // 4xx errors ไม่ควร retry
        } else if (error.message.includes('HTTP 5')) {
            errorMessage = 'เซิร์ฟเวอร์ Google มีปัญหา (Server Error)';
            shouldRetry = true; // 5xx errors ควร retry
        }

        // Retry logic
        if (shouldRetry && retryCount < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return sendToGoogleSheets(data, retryCount + 1);
        }

        // Final error
        const finalError = new Error(`${errorMessage} (หลังจากลอง ${retryCount + 1} ครั้ง)`);
        finalError.originalError = error;
        throw finalError;
    }
}

// Show notification function (assuming it exists globally or define it here)
function showNotification(message, type, subtext = '') {
    // If notification function doesn't exist globally, implement it here
    console.log(`${type.toUpperCase()}: ${message}${subtext ? ' - ' + subtext : ''}`);
    
    // Try to use global notification if available
    if (window.showNotification) {
        window.showNotification(message, type, subtext);
    } else {
        // Simple fallback alert
        alert(message);
    }
}

// Get user data for Google Sheets
async function getUserData() {
    if (!auth.currentUser || !db) {
        return null;
    }

    const userId = auth.currentUser.uid;
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'registration_data', 'profile');
    
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Error getting user data:", error);
        return null;
    }
}

// Submit Data with proper Firestore integration and Google Sheets
async function submitData() {
    let submitButton;
    let originalText;
    
    try {
        // เช็ค network ก่อน
        if (!navigator.onLine) {
            showNotification('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบ WiFi หรือเครือข่าย', 'error');
            return;
        }

        // Check if user can submit today
        const canSubmit = await checkDailySubmissionLimit();
        if (!canSubmit) {
            showNotification('วันนี้คุณส่งข้อมูลไปแล้ว กรุณารอจนถึงพรุ่งนี้', 'warning');
            return;
        }

        // Check if photo is uploaded
        const photoUploaded = !document.getElementById('photoPreview').classList.contains('hidden');
        
        if (!photoUploaded) {
            showNotification('กรุณาอัพโหลดภาพก่อนส่งข้อมูล', 'error');
            return;
        }

        // Check if user is authenticated
        if (!auth.currentUser) {
            showNotification('กรุณาเข้าสู่ระบบก่อน', 'error');
            return;
        }

        // Show loading state
        submitButton = document.querySelector('[onclick="submitData()"]');
        originalText = submitButton?.textContent || submitButton?.innerHTML || '';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<span>กำลังบันทึก...</span>';
        }
        
        // Get all required data
        const currentPoints = parseInt(document.getElementById('totalPoints').textContent) || 0;
        const currentHealthPoints = parseInt(document.getElementById('healthPoints').textContent) || 0;
        const newPoints = currentPoints + 5;
        
        const currentDays = parseInt(document.getElementById('consecutiveDays').textContent) || 0;
        const newDays = currentDays + 1;

        const newLevel = Math.floor(newPoints / 50);
        const currentLevel = parseInt(document.getElementById('userLevel').textContent) || 0;
        const exerciseTime = parseInt(document.getElementById('currentTime').textContent) || 30;
        const photoUrl = document.getElementById('previewImage').src || '';
        
        // Get user data
        const userData = await getUserData();
        const username = userData?.name || userData?.displayName || auth.currentUser.email || 'ไม่ระบุ';

        // Prepare data
        const today = new Date().toISOString().split('T')[0];
        const dataToUpdate = {
            healthPoints: newPoints,
            consecutiveDays: newDays,
            level: newLevel,
            lastExerciseDate: today,
            exerciseStreak: newDays,
            photoSubmitted: true,
            lastSubmissionTime: new Date().toISOString()
        };

        const googleSheetsData = {
            username: username,
            exerciseTime: exerciseTime,
            photoUrl: photoUrl.startsWith('data:image/') ? 'มีรูปภาพ' : 'ไม่มีรูป',
            healthPoints: newPoints,
            consecutiveDays: newDays,
            level: newLevel,
            submissionDate: today,
            timestamp: new Date().toISOString()
        };

        console.log('Data prepared:', { dataToUpdate, googleSheetsData });

        // Step 1: Save to Firestore (ต้องสำเร็จก่อน)
        if (submitButton) {
            submitButton.innerHTML = '<span>กำลังบันทึกในแอป...</span>';
        }
        
        await saveUserData(dataToUpdate);
        console.log("✅ Firestore save successful");

        // Step 2: Try to send to Google Sheets (ไม่บล็อกถ้าไม่สำเร็จ)
        if (submitButton) {
            submitButton.innerHTML = '<span>กำลังส่งไป Google Sheets...</span>';
        }

        let sheetsSuccess = false;
        try {
            // ทดสอบการเชื่อมต่อก่อน
            const connectionTest = await testGoogleAppsScriptConnection();
            
            if (!connectionTest.success) {
                throw new Error(`ไม่สามารถเชื่อมต่อ Google Apps Script ได้ (${connectionTest.error})`);
            }

            const sheetsResult = await sendToGoogleSheets(googleSheetsData);
            console.log("✅ Google Sheets success:", sheetsResult);
            sheetsSuccess = true;
            
        } catch (sheetsError) {
            console.error("❌ Google Sheets failed:", sheetsError);
            
            // แสดง error message ที่เฉพาะเจาะจง
            if (sheetsError.message.includes('timeout')) {
                showNotification('บันทึกในแอปสำเร็จ! แต่การส่งไป Google Sheets ใช้เวลานานเกินไป', 'warning');
            } else if (sheetsError.message.includes('Network Error')) {
                showNotification('บันทึกในแอปสำเร็จ! แต่ไม่สามารถเชื่อมต่อ Google Sheets ได้ในขณะนี้', 'warning');
            } else {
                showNotification(`บันทึกในแอปสำเร็จ! ปัญหา Google Sheets: ${sheetsError.message}`, 'warning');
            }
        }

        // Update UI regardless of Google Sheets result
        const exerciseStatusElement = document.getElementById('exerciseStatus');
        if (exerciseStatusElement) {
            exerciseStatusElement.textContent = 'วันนี้คุณส่งผลแล้ว ✅';
            exerciseStatusElement.classList.add('text-green-600');
        }
        
        // Animate UI updates
        animatePointIncrease('totalPoints', currentPoints, newPoints);
        animatePointIncrease('healthPoints', currentHealthPoints, newPoints);
        document.getElementById('consecutiveDays').textContent = newDays;
        
        if (newLevel > currentLevel) {
            document.getElementById('userLevel').textContent = newLevel;
            if (window.renderLevelStars) {
                renderLevelStars('levelStarsMain', newLevel);
                renderLevelStars('levelStarsPopup', newLevel);
            }
            showNotification(`ยินดีด้วย! คุณเลื่อนขึ้นสู่เลเวล ${newLevel}!`, 'success');
        }
        
        // Final success message
        if (sheetsSuccess) {
            showNotification('ส่งข้อมูลสำเร็จทั้งในแอปและ Google Sheets! ได้รับ +5 แต้ม', 'success');
        } else {
            showNotification('บันทึกในแอปสำเร็จ! ได้รับ +5 แต้มสุขภาพ (Google Sheets จะอัพเดทภายหลัง)', 'success');
        }
        
        // Disable submit button
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.classList.add('opacity-50', 'cursor-not-allowed');
            submitButton.innerHTML = '<span class="text-2xl">✅</span><span>ส่งข้อมูลแล้วจ้า</span>';
        }

        disablePhotoButtons();
        
    } catch (error) {
        console.error("❌ submitData error:", error);
        
        let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
        
        if (error.message.includes('User not authenticated')) {
            errorMessage = 'กรุณาเข้าสู่ระบบใหม่';
        } else if (error.message.includes('permission-denied')) {
            errorMessage = 'ไม่มีสิทธิ์เข้าถึงข้อมูล กรุณาเข้าสู่ระบบใหม่';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
        
        // Reset button
        if (submitButton && originalText) {
            submitButton.disabled = false;
            submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
            submitButton.innerHTML = originalText;
        }
    }
}

// ส่วนที่ 4: เพิ่ม listener สำหรับ online/offline status
window.addEventListener('online', () => {
    console.log('📶 Connection restored');
    showNotification('การเชื่อมต่ออินเทอร์เน็ตกลับมาแล้ว', 'info');
});

window.addEventListener('offline', () => {
    console.log('📵 Connection lost');
    showNotification('ไม่มีการเชื่อมต่ออินเทอร์เน็ต', 'warning');
});

// ส่วนที่ 5: Debug function
window.debugGoogleSheets = async function() {
    console.log('=== Debug Google Sheets Connection ===');
    console.log('URL:', GOOGLE_APPS_SCRIPT_URL);
    console.log('Online:', navigator.onLine);
    
    const testResult = await testGoogleAppsScriptConnection();
    console.log('Connection test:', testResult);
    
    if (testResult.success) {
        console.log('✅ Connection OK, testing data send...');
        try {
            const testData = {
                username: 'ทดสอบการเชื่อมต่อ',
                exerciseTime: 30,
                healthPoints: 100,
                consecutiveDays: 1,
                level: 2,
                submissionDate: new Date().toISOString().split('T')[0]
            };
            const result = await sendToGoogleSheets(testData);
            console.log('✅ Test send successful:', result);
        } catch (error) {
            console.log('❌ Test send failed:', error);
        }
    } else {
        console.log('❌ Connection failed');
    }
};

// Disable photo upload functionality
function disablePhotoButtons() {
    const takePhotoBtn = document.querySelector('[onclick="takePhoto()"]');
    const uploadPhotoBtn = document.querySelector('[onclick="uploadPhoto()"]');
    
    if (takePhotoBtn) {
        takePhotoBtn.disabled = true;
        takePhotoBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    
    if (uploadPhotoBtn) {
        uploadPhotoBtn.disabled = true;
        uploadPhotoBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// Enable photo upload functionality
function enablePhotoButtons() {
    const takePhotoBtn = document.querySelector('[onclick="takePhoto()"]');
    const uploadPhotoBtn = document.querySelector('[onclick="uploadPhoto()"]');
    
    if (takePhotoBtn) {
        takePhotoBtn.disabled = false;
        takePhotoBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    
    if (uploadPhotoBtn) {
        uploadPhotoBtn.disabled = false;
        uploadPhotoBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// Animate point increase
function animatePointIncrease(elementId, startValue, endValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const duration = 1000;
    const startTime = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = Math.floor(startValue + (endValue - startValue) * progress);
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

// Render level stars (assuming this function exists or define it)
function renderLevelStars(containerId, level) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const maxStars = 5;
    
    for (let i = 1; i <= maxStars; i++) {
        const starSpan = document.createElement('span');
        starSpan.textContent = '★';
        
        if (i <= level) {
            starSpan.className = 'text-2xl text-yellow-400';
        } else {
            starSpan.className = 'text-2xl text-gray-400';
        }
        
        if (containerId === 'levelStarsPopup') {
            starSpan.classList.add('text-xl');
        }
        
        container.appendChild(starSpan);
    }
}

// Check submission status and update UI
async function checkSubmissionStatus() {
    if (!auth.currentUser || !db) {
        return;
    }

    const userId = auth.currentUser.uid;
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'registration_data', 'profile');
    
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const lastSubmissionDate = userData.lastExerciseDate;
            const today = new Date().toISOString().split('T')[0];
            
            const submitButton = document.querySelector('[onclick="submitData()"]');
            const exerciseStatusElement = document.getElementById('exerciseStatus');
            
            if (lastSubmissionDate === today) {
                // Already submitted today
                if (exerciseStatusElement) {
                    exerciseStatusElement.textContent = 'วันนี้คุณส่งผลแล้ว ✅';
                    exerciseStatusElement.classList.add('text-green-600');
                }
                
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.classList.add('opacity-50', 'cursor-not-allowed');
                    submitButton.innerHTML = '<span class="text-2xl">✅</span><span>ส่งข้อมูลแล้วจ้า</span>';
                }
                
                // Disable photo buttons
                disablePhotoButtons();
                
                // Show next submission time
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowString = tomorrow.toLocaleDateString('th-TH');
                
            } else {
                // Can submit today
                if (exerciseStatusElement) {
                    exerciseStatusElement.textContent = 'คุณยังไม่ออกกำลังกาย';
                    exerciseStatusElement.classList.remove('text-green-600');
                }
                
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
                    submitButton.innerHTML = '<span class="text-2xl">🚀</span><span>ส่งข้อมูลเข้าระบบ</span>';
                }
                
                // Enable photo buttons
                enablePhotoButtons();
            }
        } else {
            // No data exists, enable everything
            enablePhotoButtons();
        }
    } catch (error) {
        console.error("Error checking submission status:", error);
    }
}

// Make functions available globally
window.updateExerciseTime = updateExerciseTime;
window.takePhoto = takePhoto;
window.uploadPhoto = uploadPhoto;
window.handlePhotoUpload = handlePhotoUpload;
window.showLevelPopup = showLevelPopup;
window.closeLevelPopup = closeLevelPopup;
window.showExpInfo = showExpInfo;
window.closeExpInfo = closeExpInfo;
window.submitData = submitData;
window.checkSubmissionStatus = checkSubmissionStatus;
window.checkDailySubmissionLimit = checkDailySubmissionLimit;

// Initialize slider and check submission status
document.addEventListener('DOMContentLoaded', function() {
    updateExerciseTime(30);
    
    // Check submission status when page loads
    setTimeout(() => {
        checkSubmissionStatus();
    }, 2000); // Wait 2 seconds for Firebase to initialize
});
function validateSubmissionData(data) {
    const required = ['username', 'exerciseTime', 'healthPoints'];
    const missing = required.filter(field => !data[field] && data[field] !== 0);
    
    if (missing.length > 0) {
        throw new Error(`ข้อมูลไม่ครบ: ${missing.join(', ')}`);
    }
    
    // Validate data types
    if (typeof data.exerciseTime !== 'number' || data.exerciseTime < 0 || data.exerciseTime > 300) {
        throw new Error('เวลาออกกำลังกายไม่ถูกต้อง (0-300 นาที)');
    }
    
    if (typeof data.healthPoints !== 'number' || data.healthPoints < 0) {
        throw new Error('คะแนนสุขภาพต้องเป็นตัวเลขบวก');
    }
    
    return true;
}
async function testGoogleAppsScriptConnection() {
    try {
        console.log('Testing Google Apps Script connection...');
        
        if (!GOOGLE_APPS_SCRIPT_URL) {
            throw new Error('GOOGLE_APPS_SCRIPT_URL ไม่ได้กำหนด');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'GET', // ใช้ GET เพื่อทดสอบ
            mode: 'cors',
            cache: 'no-cache',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('Connection test result:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText
        };

    } catch (error) {
        console.error('Connection test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}