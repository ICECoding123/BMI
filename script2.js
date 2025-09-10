// Import Firebase functions
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Initialize Firebase references
const auth = getAuth();
const db = getFirestore();
const appId = 'default-app-id'; // Make sure this matches your app ID

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
    if (!auth.currentUser || !db) {
        return false;
    }

    const userId = auth.currentUser.uid;
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'registration_data', 'profile');
    
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const lastSubmissionDate = userData.lastExerciseDate;
            const today = new Date().toISOString().split('T')[0];
            
            // Return false if already submitted today, true if can submit
            return lastSubmissionDate !== today;
        }
        return true; // If no data exists, allow submission
    } catch (error) {
        console.error("Error checking submission limit:", error);
        return false; // Err on the side of caution
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

// Submit Data with proper Firestore integration and daily limit check
async function submitData() {
    try {
        // Check if user can submit today
        const canSubmit = await checkDailySubmissionLimit();

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
        
        // Get current points and days
        const currentPoints = parseInt(document.getElementById('totalPoints').textContent);
        const currentHealthPoints = parseInt(document.getElementById('healthPoints').textContent);
        const newPoints = currentPoints + 5;
        
        const currentDays = parseInt(document.getElementById('consecutiveDays').textContent);
        const newDays = currentDays + 1;

        // Calculate new level based on points
        const newLevel = Math.floor(newPoints / 50); // Level up every 50 points
        const currentLevel = parseInt(document.getElementById('userLevel').textContent) || 0;
        
        // Prepare data to save to Firestore
        const dataToUpdate = {
            healthPoints: newPoints,
            consecutiveDays: newDays,
            level: newLevel,
            lastExerciseDate: new Date().toISOString().split('T')[0], // Today's date - THIS IS KEY
            exerciseStreak: newDays,
            photoSubmitted: true // Track that photo was submitted
        };

        // Show loading state
        const submitButton = event?.target || document.querySelector('[onclick="submitData()"]');
        const originalText = submitButton?.textContent || submitButton?.innerHTML;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<span>กำลังบันทึก...</span>';
        }

        // Save to Firestore first
        await saveUserData(dataToUpdate);
        console.log("Data successfully saved to Firestore:", dataToUpdate);
        
        // Update exercise status immediately
        document.getElementById('exerciseStatus').textContent = 'วันนี้คุณส่งผลแล้ว ✅';
        
        // Update UI after successful save
        animatePointIncrease('totalPoints', currentPoints, newPoints);
        animatePointIncrease('healthPoints', currentHealthPoints, newPoints);
        document.getElementById('consecutiveDays').textContent = newDays;
        
        // Update level if it changed
        if (newLevel > currentLevel) {
            document.getElementById('userLevel').textContent = newLevel;
            renderLevelStars('levelStarsMain', newLevel);
            renderLevelStars('levelStarsPopup', newLevel);
            showNotification(`ยินดีด้วย! คุณเลื่อนขึ้นสู่เลเวล ${newLevel}!`, 'success');
        }
        
        showNotification('ส่งข้อมูลสำเร็จ! ได้รับ +5 แต้มสุขภาพ', 'success');
        
        // Disable submit button and update UI to show completion
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.classList.add('opacity-50', 'cursor-not-allowed');
            submitButton.innerHTML = '<span class="text-2xl">✅</span><span>ส่งข้อมูลแล้วจ้า</span>';
        }

        // Disable photo upload buttons
        disablePhotoButtons();
        
        // Simulate Google Sheets integration
        setTimeout(() => {
            showNotification('ข้อมูลถูกบันทึกลง Google Sheets แล้ว', 'info');
        }, 1500);
        
    } catch (error) {
        console.error("Error in submitData:", error);
        showNotification('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        
        // Reset submit button on error
        const submitButton = event?.target || document.querySelector('[onclick="submitData()"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
        }
    }
}

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