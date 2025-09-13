// Import Firebase functions
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Initialize Firebase references
const auth = getAuth();
const db = getFirestore();
const appId = 'default-app-id'; // Make sure this matches your app ID

// Sheet.best API URL - เปลี่ยนเป็น URL ของ Google Sheet ที่คุณสร้างใน Sheet.best
const SHEET_BEST_URL = 'https://sheet.best/api/sheets/49762d95-6c55-4a1f-9a48-0169dce585d6';

// Global variable to store current photo data
let currentPhotoData = null;
// Calculate current level from total EXP
// Exercise Time Update
function updateExerciseTime(value) {
    document.getElementById('currentTime').textContent = value;
    const runner = document.querySelector('.runner-animation');
    const percentage = (value / 60) * 100;
    runner.style.left = percentage + '%';
    
    const progressBar = runner.previousElementSibling;
    progressBar.style.width = percentage + '%';
}
function updateExpProgressBar(currentExp, currentLevel) {
    const currentExpInLevel = currentExp % 50; // EXP ในเลเวลปัจจุบัน (0-49)
    const nextLevelExp = 50; // EXP ที่ต้องการสำหรับเลเวลถัดไป
    const expToNext = nextLevelExp - currentExpInLevel;
    const progressPercentage = (currentExpInLevel / nextLevelExp) * 100;
    
    // Update display elements
    const currentExpElement = document.getElementById('currentExp');
    const nextLevelExpElement = document.getElementById('nextLevelExp');
    const expToNextElement = document.getElementById('expToNext');
    const progressBarElement = document.getElementById('progressBar');
    const levelElement = document.getElementById('level');
    
    if (currentExpElement) currentExpElement.textContent = currentExpInLevel;
    if (nextLevelExpElement) nextLevelExpElement.textContent = nextLevelExp;
    if (expToNextElement) {
        if (expToNext === 0) {
            expToNextElement.textContent = `ถึงเลเวล ${currentLevel + 1} แล้ว!`;
        } else {
            expToNextElement.textContent = `อีก ${expToNext} EXP เพื่อเลเวล ${currentLevel + 1}`;
        }
    }
    if (progressBarElement) {
        progressBarElement.style.width = `${progressPercentage}%`;
    }
    if (levelElement) levelElement.textContent = currentLevel;
    
    console.log(`EXP Progress Updated: ${currentExpInLevel}/${nextLevelExp} (${progressPercentage.toFixed(1)}%)`);
}

// Photo Functions
function takePhoto() {
    // Check if user can submit today before allowing photo capture
    checkDailySubmissionLimit().then(canSubmit => {
        if (canSubmit) {
            alert('เปิดกล้องถ่ายภาพ (ฟีเจอร์นี้ต้องการการเชื่อมต่อกับกล้อง)');
        } else {
            alert('วันนี้คุณส่งข้อมูลไปแล้ว กรุณารอจนถึงพรุ่งนี้');
        }
    });
}

function uploadPhoto() {
    // Check if user can submit today before allowing photo upload
    checkDailySubmissionLimit().then(canSubmit => {
        if (canSubmit) {
            document.getElementById('photoInput').click();
        } else {
            showNotification('วันนี้คุณส่งข้อมูลไปแล้ว กรุณารอจนถึงพรุ่งนี้', 'warning');
        }
    });
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
        // Check file size (limit to 5MB for Google Sheets)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('รูปภาพใหญ่เกินไป กรุณาเลือกรูปที่เล็กกว่า 5MB', 'error');
            return;
        }

        // Double-check submission limit before processing the photo
        checkDailySubmissionLimit().then(canSubmit => {
            if (canSubmit) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const base64Data = e.target.result;
                    currentPhotoData = {
                        base64: base64Data,
                        filename: file.name,
                        size: file.size,
                        type: file.type
                    };
                    
                    document.getElementById('previewImage').src = base64Data;
                    document.getElementById('photoPreview').classList.remove('hidden');
                    document.getElementById('uploadPlaceholder').classList.add('hidden');
                    showNotification('อัพโหลดภาพสำเร็จ!', 'success', 'พร้อมส่งข้อมูลเข้าระบบแล้ว');
                };
                reader.readAsDataURL(file);
            } else {
                showNotification('วันนี้คุณส่งข้อมูลไปแล้ว', 'warning');
            }
        });
    } else {
        showNotification('กรุณาเลือกไฟล์ .jpg หรือ .png เท่านั้น', 'error');
    }
}

// Compress image to reduce base64 size for Google Sheets
function compressImage(base64Data, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            
            console.log(`Image compressed: ${base64Data.length} -> ${compressedBase64.length} chars`);
            resolve(compressedBase64);
        };
        
        img.src = base64Data;
    });
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

// Send data to Google Sheets via Sheet.best (with image support)
async function sendToSheetBest(data, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds
    
    try {
        console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES + 1} - Sending to Sheet.best:`, {
            ...data,
            image: data.image ? `[Image data: ${data.image.length} chars]` : 'No image'
        });
        
        // ตรวจสอบ URL ก่อน
        if (!SHEET_BEST_URL || !SHEET_BEST_URL.startsWith('https://sheet.best/api/sheets/')) {
            throw new Error('Sheet.best URL ไม่ถูกต้อง - กรุณาแทนที่ YOUR_SHEET_ID_HERE ด้วย Sheet ID จริง');
        }

        // สร้าง AbortController สำหรับ timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('Request timeout - aborting');
            controller.abort();
        }, 30000); // เพิ่ม timeout เป็น 30 วินาทีสำหรับการส่งรูป

        // Validate ข้อมูลก่อนส่ง
        validateSubmissionData(data);

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data),
            mode: 'cors',
            cache: 'no-cache',
            signal: controller.signal
        };

        console.log('Sending to Sheet.best URL:', SHEET_BEST_URL);

        const response = await fetch(SHEET_BEST_URL, fetchOptions);
        
        clearTimeout(timeoutId);
        
        console.log('Sheet.best response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            url: response.url,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            // Handle specific HTTP errors
            if (response.status === 400) {
                throw new Error('ข้อมูลที่ส่งไม่ถูกต้อง (400 Bad Request)');
            } else if (response.status === 401) {
                throw new Error('ไม่มีสิทธิ์เข้าถึง Sheet.best API (401 Unauthorized)');
            } else if (response.status === 403) {
                throw new Error('การเข้าถึงถูกปฏิเสธ - ตรวจสอบ API key หรือสิทธิ์ (403 Forbidden)');
            } else if (response.status === 404) {
                throw new Error('ไม่พบ Google Sheet - ตรวจสอบ Sheet ID (404 Not Found)');
            } else if (response.status === 413) {
                throw new Error('ข้อมูลใหญ่เกินไป - ลองส่งรูปที่เล็กกว่า (413 Payload Too Large)');
            } else if (response.status >= 500) {
                throw new Error(`เซิร์ฟเวอร์ Sheet.best มีปัญหา (${response.status})`);
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }

        // อ่าน response
        const responseText = await response.text();
        console.log('Sheet.best response body:', responseText);
        
        // พยายาม parse JSON
        let result;
        try {
            result = responseText ? JSON.parse(responseText) : { success: true };
            console.log('Parsed Sheet.best response:', result);
        } catch (parseError) {
            console.log('Response is not JSON, treating as success');
            // Sheet.best บางครั้งส่งกลับแค่ status 200 โดยไม่มี JSON body
            if (response.ok) {
                return {
                    success: true,
                    message: 'Data and image sent successfully to Google Sheets',
                    timestamp: new Date().toISOString()
                };
            }
        }
        
        // Sheet.best จะส่งกลับ status 200 หากส่งสำเร็จ
        console.log('✅ Sheet.best success:', result || 'Success (no JSON response)');
        return result || { success: true, message: 'Data sent successfully' };
        
    } catch (error) {
        console.error(`Sheet.best attempt ${retryCount + 1} failed:`, error);
        
        // จำแนกประเภท error
        let shouldRetry = false;
        let errorMessage = error.message;

        if (error.name === 'AbortError') {
            errorMessage = 'การส่งข้อมูลใช้เวลานานเกินไป (timeout)';
            shouldRetry = true;
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'ไม่สามารถเชื่อมต่อได้ (Network Error)';
            shouldRetry = true;
        } else if (error.message.includes('500')) {
            errorMessage = 'เซิร์ฟเวอร์ Sheet.best มีปัญหาชั่วคราว';
            shouldRetry = true;
        } else if (error.message.includes('413')) {
            errorMessage = 'รูปภาพใหญ่เกินไป - กรุณาลดขนาดรูป';
            shouldRetry = false; // Don't retry for payload too large
        } else if (error.message.includes('400') || error.message.includes('404')) {
            shouldRetry = false; // Client errors ไม่ควร retry
        }

        // Retry logic
        if (shouldRetry && retryCount < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return sendToSheetBest(data, retryCount + 1);
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

// Submit Data with proper Firestore integration and Sheet.best (including image)
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
        
        if (!photoUploaded || !currentPhotoData) {
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
        
        // Get user data
        const userData = await getUserData();
        const username = userData?.name || userData?.displayName || auth.currentUser.email || 'ไม่ระบุ';
        const currentExp = userData?.exp || parseInt(document.getElementById('currentExp')?.textContent) || 0;
        const newExp = currentExp + 5;
        // Prepare data
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        const dataToUpdate = {
            healthPoints: newPoints,
            consecutiveDays: newDays,
            level: newLevel,
            exp: newExp,  // เพิ่มบรรทัดนี้
            lastExerciseDate: today,
            exerciseStreak: newDays,
            photoSubmitted: true,
            lastSubmissionTime: now.toISOString()
        };

        // Compress image for Google Sheets
        if (submitButton) {
            submitButton.innerHTML = '<span>กำลังบีบอัดรูปภาพ...</span>';
        }
        
        const compressedImage = await compressImage(currentPhotoData.base64, 600, 0.7);

        // Sheet.best ต้องการ flat object structure รวมถึงรูปภาพ
        const sheetData = {
            timestamp: now.toISOString(),
            date: today,
            time: now.toLocaleTimeString('th-TH'),
            username: username,
            exerciseTime: exerciseTime,
            healthPoints: newPoints,
            consecutiveDays: newDays,
            level: newLevel,
            hasPhoto: 'Yes',
            image: compressedImage, // ส่งรูปในรูปแบบ base64
            imageFilename: currentPhotoData.filename,
            imageSize: currentPhotoData.size,
            imageType: currentPhotoData.type,
            submissionStatus: 'Success',
            notes: `Exercise: ${exerciseTime} minutes, Level: ${newLevel}, Photo: ${currentPhotoData.filename}`
        };

        console.log('Data prepared:', { dataToUpdate, sheetDataSize: JSON.stringify(sheetData).length });

        // Step 1: Save to Firestore (ต้องสำเร็จก่อน)
        if (submitButton) {
            submitButton.innerHTML = '<span>กำลังบันทึกในแอป...</span>';
        }
        
        await saveUserData(dataToUpdate);
        console.log("✅ Firestore save successful");

        // Step 2: Try to send to Google Sheets via Sheet.best (รวมรูปภาพ)
        if (submitButton) {
            submitButton.innerHTML = '<span>กำลังส่งไป Google Sheets พร้อมรูปภาพ...</span>';
        }

        let sheetsSuccess = false;
        try {
            const sheetsResult = await sendToSheetBest(sheetData);
            console.log("✅ Sheet.best success (with image):", sheetsResult);
            sheetsSuccess = true;
            
        } catch (sheetsError) {
            console.error("❌ Sheet.best failed:", sheetsError);
            
            // แสดง error message ที่เฉพาะเจาะจง
            if (sheetsError.message.includes('timeout')) {
                showNotification('บันทึกในแอปสำเร็จ! แต่การส่งไป Google Sheets ใช้เวลานานเกินไป', 'warning');
            } else if (sheetsError.message.includes('Network Error')) {
                showNotification('บันทึกในแอปสำเร็จ! แต่ไม่สามารถเชื่อมต่อ Google Sheets ได้ในขณะนี้', 'warning');
            } else if (sheetsError.message.includes('413') || sheetsError.message.includes('ใหญ่เกินไป')) {
                showNotification('บันทึกในแอปสำเร็จ! แต่รูปภาพใหญ่เกินไปสำหรับ Google Sheets', 'warning');
            } else if (sheetsError.message.includes('YOUR_SHEET_ID_HERE')) {
                showNotification('บันทึกในแอปสำเร็จ! กรุณาตั้งค่า Sheet.best URL ในโค้ด', 'warning');
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
            showNotification('ส่งข้อมูลสำเร็จทั้งในแอปและ Google Sheets! ได้รับ +5 แต้ม (รวมรูปภาพ)', 'success');
        } else {
            showNotification('บันทึกในแอปสำเร็จ! ได้รับ +5 แต้มสุขภาพ (Google Sheets จะอัพเดทภายหลัง)', 'success');
        }
        
        // Clear photo data
        currentPhotoData = null;
        
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

// เพิ่ม listener สำหรับ online/offline status
window.addEventListener('online', () => {
    console.log('🟢 Connection restored');
    showNotification('การเชื่อมต่ออินเทอร์เน็ตกลับมาแล้ว', 'info');
});

window.addEventListener('offline', () => {
    console.log('🔴 Connection lost');
    showNotification('ไม่มีการเชื่อมต่ออินเทอร์เน็ต', 'warning');
});

// Debug function for testing Sheet.best connection with image
window.debugSheetBest = async function() {
    console.log('=== Debug Sheet.best Connection (with Image) ===');
    console.log('URL:', SHEET_BEST_URL);
    console.log('Online:', navigator.onLine);
    
    if (SHEET_BEST_URL.includes('YOUR_SHEET_ID_HERE')) {
        console.log('❌ กรุณาแทนที่ SHEET_BEST_URL ด้วย URL จริงจาก Sheet.best');
        console.log('ขั้นตอนการตั้งค่า:');
        console.log('1. ไปที่ https://sheet.best');
        console.log('2. สร้าง/เลือก Google Sheet');
        console.log('3. ใส่หัวตารางในแถวแรก: timestamp, date, time, username, exerciseTime, healthPoints, consecutiveDays, level, hasPhoto, image, imageFilename, imageSize, imageType, submissionStatus, notes');
        console.log('4. Connect กับ Sheet.best');
        console.log('5. คัดลอก URL ที่ได้มาใส่ในโค้ดบรรทัดที่ 9');
        return;
    }
    
    // Create a small test image (1x1 pixel red dot)
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 1, 1);
    const testImageBase64 = canvas.toDataURL('image/png');
    
    console.log('✅ Testing data send with image...');
    try {
        const testData = {
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('th-TH'),
            username: 'ทดสอบการเชื่อมต่อ',
            exerciseTime: 30,
            healthPoints: 100,
            consecutiveDays: 1,
            level: 2,
            hasPhoto: 'Yes',
            image: testImageBase64,
            imageFilename: 'test-image.png',
            imageSize: testImageBase64.length,
            imageType: 'image/png',
            submissionStatus: 'Test',
            notes: 'This is a test submission with image'
        };
        const result = await sendToSheetBest(testData);
        console.log('✅ Test send with image successful:', result);
        alert('การทดสอบ Sheet.best สำเร็จ (รวมรูปภาพ)! ตรวจสอบ Google Sheet ของคุณ');
    } catch (error) {
        console.log('❌ Test send failed:', error);
        alert(`การทดสอบล้มเหลว: ${error.message}`);
    }
};

// Disable photo upload functionality
function disablePhotoButtons() {
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

// Validate submission data (including image)
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
    
    // Validate image if present
    if (data.image) {
        if (typeof data.image !== 'string' || !data.image.startsWith('data:image/')) {
            throw new Error('รูปภาพไม่ถูกต้อง');
        }
        
        // Check approximate size (base64 is ~1.33x larger than original)
        if (data.image.length > 7000000) { // ~5MB in base64
            throw new Error('รูปภาพใหญ่เกินไป (เกิน 5MB)');
        }
    }
    
    return true;
}

// Clear photo preview
function clearPhotoPreview() {
    currentPhotoData = null;
    document.getElementById('photoPreview').classList.add('hidden');
    document.getElementById('uploadPlaceholder').classList.remove('hidden');
    document.getElementById('previewImage').src = '';
    
    // Reset file input
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.value = '';
    }
}

// Add function to handle photo removal
function removePhoto() {
    clearPhotoPreview();
    showNotification('ลบรูปภาพแล้ว', 'info');
}

// Enhanced photo preview with remove button
function enhancePhotoPreview() {
    const photoPreview = document.getElementById('photoPreview');
    if (!photoPreview) return;
    
    // Add remove button if not exists
    let removeBtn = photoPreview.querySelector('.remove-photo-btn');
    if (!removeBtn) {
        removeBtn = document.createElement('button');
        removeBtn.className = 'remove-photo-btn absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = removePhoto;
        removeBtn.title = 'ลบรูปภาพ';
        
        if (photoPreview.style.position !== 'absolute') {
            photoPreview.style.position = 'relative';
        }
        
        photoPreview.appendChild(removeBtn);
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
window.removePhoto = removePhoto;
window.clearPhotoPreview = clearPhotoPreview;
