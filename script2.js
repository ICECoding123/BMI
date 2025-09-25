// Import Firebase functions
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Initialize Firebase references
const auth = getAuth();
const db = getFirestore();
const appId = 'default-app-id';

// Sheet.best API URL
const SHEET_BEST_URL = 'https://sheet.best/api/sheets/c7f9ae9a-a030-4148-92fe-a0572c703e45';

// Global variables
let currentPhotoData = null;
let selectedExerciseType = '';
let selectedExerciseIcon = '';
let totalExerciseTimeMinutes = 0; // New: Total exercise time tracker

// Progressive EXP System - Level thresholds
const LEVEL_THRESHOLDS = [
    { level: 0, minExp: 0, maxExp: 40, nextLevelExp: 40 },      // Level 0: 0-40 exp
    { level: 1, minExp: 40, maxExp: 100, nextLevelExp: 100 },   // Level 1: 41-100 exp  
    { level: 2, minExp: 100, maxExp: 180, nextLevelExp: 180 },  // Level 2: 101-180 exp
    { level: 3, minExp: 180, maxExp: 320, nextLevelExp: 320 },  // Level 3: 181-320 exp
    { level: 4, minExp: 320, maxExp: 500, nextLevelExp: 500 },  // Level 4: 321-500 exp
    { level: 5, minExp: 500, maxExp: Infinity, nextLevelExp: null } // Level 5: MAX LEVEL
];

// Exercise type selection functions
function selectExerciseType(type, icon) {
    selectedExerciseType = type;
    selectedExerciseIcon = icon;
    
    // Update UI
    const selectedExerciseDiv = document.getElementById('selectedExercise');
    const selectedExerciseText = document.getElementById('selectedExerciseText');
    const selectedExerciseIconElement = document.getElementById('selectedExerciseIcon');
    
    if (selectedExerciseDiv) {
        selectedExerciseDiv.classList.remove('hidden');
    }
    
    if (selectedExerciseText) {
        selectedExerciseText.textContent = type;
    }
    
    if (selectedExerciseIconElement) {
        selectedExerciseIconElement.textContent = icon;
    }
    
    // Remove active class from all buttons and add to selected
    const exerciseButtons = document.querySelectorAll('.exercise-type-btn');
    exerciseButtons.forEach(btn => {
        btn.classList.remove('ring-4', 'ring-blue-300', 'bg-blue-200');
    });
    
    // Add active styling to selected button
    const selectedButton = document.querySelector(`[onclick="selectExerciseType('${type}', '${icon}')"]`);
    if (selectedButton) {
        selectedButton.classList.add('ring-4', 'ring-blue-300', 'bg-blue-200');
    }
    
    console.log(`Selected exercise: ${type} (${icon})`);
    showNotification(`เลือก${type}แล้ว!`, 'success');
}

function clearExerciseSelection() {
    selectedExerciseType = '';
    selectedExerciseIcon = '';
    
    const selectedExerciseDiv = document.getElementById('selectedExercise');
    if (selectedExerciseDiv) {
        selectedExerciseDiv.classList.add('hidden');
    }
    
    // Remove active styling from all buttons
    const exerciseButtons = document.querySelectorAll('.exercise-type-btn');
    exerciseButtons.forEach(btn => {
        btn.classList.remove('ring-4', 'ring-blue-300', 'bg-blue-200');
    });
    
    console.log('Exercise selection cleared');
    showNotification('ยกเลิกการเลือกแล้ว', 'info');
}

// EXP System Functions
function calculateLevel(totalExp) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        const threshold = LEVEL_THRESHOLDS[i];
        if (totalExp >= threshold.minExp) {
            return threshold.level;
        }
    }
    return 0; // Default to level 0
}

function getExpInCurrentLevel(totalExp) {
    const currentLevel = calculateLevel(totalExp);
    const threshold = LEVEL_THRESHOLDS.find(t => t.level === currentLevel);
    
    if (!threshold) return 0;
    
    // For max level, show total exp
    if (threshold.level === 5) {
        return totalExp;
    }
    
    // Calculate exp within current level range
    return totalExp - threshold.minExp;
}

function getExpNeededForNextLevel(totalExp) {
    const currentLevel = calculateLevel(totalExp);
    const threshold = LEVEL_THRESHOLDS.find(t => t.level === currentLevel);
    
    if (!threshold || threshold.level === 5) {
        return 0; // Max level reached
    }
    
    return threshold.nextLevelExp - totalExp;
}

function getCurrentLevelMaxExp(level) {
    const threshold = LEVEL_THRESHOLDS.find(t => t.level === level);
    if (!threshold) return 50; // fallback
    
    if (threshold.level === 5) {
        return 'MAX'; // Max level
    }
    
    return threshold.nextLevelExp - threshold.minExp;
}

function isMaxLevel(level) {
    return level >= 5;
}

// Total Exercise Time Functions
function updateTotalExerciseTimeDisplay() {
    const totalTimeElement = document.getElementById('totalExerciseTime');
    if (totalTimeElement) {
        totalTimeElement.textContent = totalExerciseTimeMinutes;
    }
    
    console.log('Total exercise time display updated:', totalExerciseTimeMinutes, 'minutes');
}

function formatExerciseTime(minutes) {
    if (minutes < 60) {
        return `${minutes} นาที`;
    } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (remainingMinutes === 0) {
            return `${hours} ชั่วโมง`;
        } else {
            return `${hours} ชม ${remainingMinutes} นาที`;
        }
    }
}

// Function to get display name with proper priority
function getDisplayName(userData = null) {
    // Priority order for display name:
    // 1. userData.firstName + userData.lastName (separate fields)
    // 2. userData.name (full name from profile)
    // 3. userData.displayName 
    // 4. Firebase Auth displayName
    // 5. Firebase Auth email (แค่ส่วนหน้า @ ถ้ามี)
    // 6. Default fallback
    
    // Check for separate first and last name fields
    if (userData?.firstName && userData?.lastName) {
        return `${userData.firstName} ${userData.lastName}`;
    }
    
    // Check for combined name field
    if (userData?.name) return userData.name;
    if (userData?.displayName) return userData.displayName;
    
    // Check Firebase Auth user info
    if (auth.currentUser?.displayName) return auth.currentUser.displayName;
    
    // Use email username part if available
    if (auth.currentUser?.email) {
        const emailUsername = auth.currentUser.email.split('@')[0];
        if (emailUsername && emailUsername.length > 0) {
            return emailUsername;
        }
    }
    
    return 'สมชาย ใจดี'; // Default fallback
}

// Function to get first name only
function getFirstName(userData = null) {
    if (userData?.firstName) return userData.firstName;
    
    // Try to extract first name from full name
    const fullName = getDisplayName(userData);
    const nameParts = fullName.split(' ');
    return nameParts[0] || 'สมชาย';
}

// Function to get last name only
function getLastName(userData = null) {
    if (userData?.lastName) return userData.lastName;
    
    // Try to extract last name from full name
    const fullName = getDisplayName(userData);
    const nameParts = fullName.split(' ');
    return nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'ใจดี';
}

// Load and display user data when page loads
async function loadUserData() {
    if (!auth.currentUser || !db) {
        console.warn('Auth or DB not available for loading user data');
        return;
    }

    try {
        const userId = auth.currentUser.uid;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'registration_data', 'profile');
        
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            console.log('Loading user data:', userData);
            
            // Load total exercise time
            totalExerciseTimeMinutes = userData.totalExerciseTime || 0;
            
            // Update UI with loaded data
            updateUserDataDisplay(userData);
            updateTotalExerciseTimeDisplay();
        } else {
            console.log('No user data found, using defaults');
            totalExerciseTimeMinutes = 0;
            
            // Set default values - เริ่มต้นที่ 0
            const defaultData = {
                healthPoints: 0,        // เปลี่ยนจาก 150 เป็น 0
                consecutiveDays: 0,     // เปลี่ยนจาก 5 เป็น 0
                exp: 0,                 // เปลี่ยนจาก 10 เป็น 0
                level: 0,
                totalExerciseTime: 0,
                firstName: getFirstName(),
                lastName: getLastName()
            };
            updateUserDataDisplay(defaultData);
            updateTotalExerciseTimeDisplay();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        totalExerciseTimeMinutes = 0;
        
        // Use defaults if error - เริ่มต้นที่ 0
        const defaultData = {
            healthPoints: 0,        // เปลี่ยนจาก 150 เป็น 0
            consecutiveDays: 0,     // เปลี่ยนจาก 5 เป็น 0
            exp: 0,                 // เปลี่ยนจาก 10 เป็น 0
            level: 0,
            totalExerciseTime: 0,
            firstName: getFirstName(),
            lastName: getLastName()
        };
        updateUserDataDisplay(defaultData);
        updateTotalExerciseTimeDisplay();
    }
}

// Update UI with user data
function updateUserDataDisplay(userData) {
    const totalExp = userData.exp || 0;        // เปลี่ยนจาก 10 เป็น 0
    const level = calculateLevel(totalExp);
    const currentLevelExp = getExpInCurrentLevel(totalExp);
    const expNeeded = getExpNeededForNextLevel(totalExp);
    
    // Get proper display name from first and last name
    const displayName = getDisplayName(userData);
    
    // Update main display
    if (document.getElementById('userName')) {
        document.getElementById('userName').textContent = displayName;
    }
    
    if (document.getElementById('userLevel')) {
        document.getElementById('userLevel').textContent = level;
    }
    
    if (document.getElementById('healthPoints')) {
        document.getElementById('healthPoints').textContent = userData.healthPoints || 0;    // เปลี่ยนจาก 150 เป็น 0
    }
    
    if (document.getElementById('totalPoints')) {
        document.getElementById('totalPoints').textContent = userData.healthPoints || 0;    // เปลี่ยนจาก 150 เป็น 0
    }
    
    if (document.getElementById('consecutiveDays')) {
        document.getElementById('consecutiveDays').textContent = userData.consecutiveDays || 0;  // เปลี่ยนจาก 5 เป็น 0
    }
    
    // Update total exercise time
    totalExerciseTimeMinutes = userData.totalExerciseTime || 0;
    updateTotalExerciseTimeDisplay();
    
    // Update popup displays
    updateExpDisplay(totalExp, level);
    
    // Render level stars
    if (window.renderLevelStars) {
        renderLevelStars('levelStarsMain', level);
        renderLevelStars('levelStarsPopup', level);
    }
    
    console.log(`User data updated - Name: ${displayName}, Total EXP: ${totalExp}, Level: ${level}, Current Level EXP: ${currentLevelExp}, Total Exercise Time: ${totalExerciseTimeMinutes} minutes`);
}

// Update EXP display in popup
function updateExpDisplay(totalExp, level) {
    const currentLevelExp = getExpInCurrentLevel(totalExp);
    const expNeeded = getExpNeededForNextLevel(totalExp);
    const currentLevelMaxExp = getCurrentLevelMaxExp(level);
    const isMax = isMaxLevel(level);
    
    // Calculate progress percentage
    let progressPercentage;
    if (isMax) {
        progressPercentage = 100; // Max level = 100% progress
    } else {
        const threshold = LEVEL_THRESHOLDS.find(t => t.level === level);
        const levelRange = threshold.nextLevelExp - threshold.minExp;
        progressPercentage = (currentLevelExp / levelRange) * 100;
    }
    
    // Update popup elements
    const currentExpElement = document.getElementById('currentExp');
    const nextLevelExpElement = document.getElementById('nextLevelExp');
    const expToNextElement = document.getElementById('expToNext');
    const progressBarElement = document.getElementById('progressBar');
    const levelElement = document.getElementById('level');
    
    if (currentExpElement) {
        currentExpElement.textContent = isMax ? totalExp : currentLevelExp;
    }
    
    if (nextLevelExpElement) {
        nextLevelExpElement.textContent = isMax ? 'MAX' : currentLevelMaxExp;
    }
    
    if (levelElement) {
        levelElement.textContent = level;
    }
    
    if (expToNextElement) {
        if (isMax) {
            expToNextElement.textContent = 'ถึงเลเวลสูงสุดแล้ว! 🎉';
        } else if (expNeeded === 0) {
            expToNextElement.textContent = `ถึงเลเวล ${level + 1} แล้ว!`;
        } else {
            expToNextElement.textContent = `อีก ${expNeeded} EXP เพื่อเลเวล ${level + 1}`;
        }
    }
    
    if (progressBarElement) {
        progressBarElement.style.width = `${progressPercentage}%`;
        
        // Change progress bar color for max level
        if (isMax) {
            progressBarElement.classList.add('bg-gradient-to-r', 'from-yellow-400', 'to-yellow-600');
            progressBarElement.classList.remove('progress-bar');
        } else {
            progressBarElement.classList.remove('bg-gradient-to-r', 'from-yellow-400', 'to-yellow-600');
            progressBarElement.classList.add('progress-bar');
        }
    }
    
    console.log(`EXP Display Updated: Level ${level} - ${isMax ? totalExp + ' (MAX)' : currentLevelExp + '/' + currentLevelMaxExp} (${progressPercentage.toFixed(1)}%) - Need ${expNeeded} more for level ${level + 1}`);
}

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
    checkDailySubmissionLimit().then(canSubmit => {
        if (canSubmit) {
            alert('เปิดกล้องถ่ายภาพ (ฟีเจอร์นี้ต้องการการเชื่อมต่อกับกล้อง)');
        } else {
            alert('วันนี้คุณส่งข้อมูลไปแล้ว กรุณารอจนถึงพรุ่งนี้');
        }
    });
}

function uploadPhoto() {
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
        if (file.size > 5 * 1024 * 1024) {
            showNotification('รูปภาพใหญ่เกินไป กรุณาเลือกรูปที่เล็กกว่า 5MB', 'error');
            return;
        }

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
            return lastSubmissionDate !== today;
        }
        
        console.log('No existing data, allowing submission');
        return true;
        
    } catch (error) {
        console.error("Error checking submission limit:", error);
        return true;
    }
}

// Level Popup Functions
function showLevelPopup() {
    // Update popup data before showing
    loadUserData().then(() => {
        document.getElementById('levelPopup').classList.remove('hidden');
    });
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
            lastUpdated: new Date()
        });
        console.log("User data successfully updated!", dataToUpdate);
        return true;
    } catch (error) {
        console.error("Error updating user data:", error);
        throw error;
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

// Submit Data with proper EXP system, exercise type, and total exercise time
async function submitData() {
    let submitButton;
    let originalText;
    
    try {
        if (!navigator.onLine) {
            showNotification('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบ WiFi หรือเครือข่าย', 'error');
            return;
        }

        const canSubmit = await checkDailySubmissionLimit();
        if (!canSubmit) {
            showNotification('วันนี้คุณส่งข้อมูลไปแล้ว กรุณารอจนถึงพรุ่งนี้', 'warning');
            return;
        }

        const photoUploaded = !document.getElementById('photoPreview').classList.contains('hidden');
        
        if (!photoUploaded || !currentPhotoData) {
            showNotification('กรุณาอัพโหลดภาพก่อนส่งข้อมูล', 'error');
            return;
        }

        // Check if exercise type is selected
        if (!selectedExerciseType || !selectedExerciseIcon) {
            showNotification('กรุณาเลือกประเภทการออกกำลังกายก่อน', 'error');
            return;
        }

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
        
        // Get current user data
        const userData = await getUserData();
        const currentExp = userData?.exp || 0;          // เปลี่ยนจาก 10 เป็น 0
        const currentLevel = calculateLevel(currentExp);
        const currentPoints = userData?.healthPoints || parseInt(document.getElementById('totalPoints').textContent) || 0;  // เปลี่ยนจาก fallback 0
        const currentDays = userData?.consecutiveDays || parseInt(document.getElementById('consecutiveDays').textContent) || 0;  // เปลี่ยนจาก fallback 0
        const currentTotalTime = userData?.totalExerciseTime || totalExerciseTimeMinutes || 0; // Current total exercise time
        
        // Calculate new values
        const expGain = 5; // EXP ที่ได้รับจากการส่งข้อมูล
        const pointGain = 5; // Points ที่ได้รับ
        const exerciseTime = parseInt(document.getElementById('currentTime').textContent) || 30;
        
        const newExp = currentExp + expGain;
        const newPoints = currentPoints + pointGain;
        const newDays = currentDays + 1;
        const newTotalTime = currentTotalTime + exerciseTime; // Add current session time to total
        const newLevel = calculateLevel(newExp);

        const displayName = getDisplayName(userData);
        const firstName = getFirstName(userData);
        const lastName = getLastName(userData);
        
        // Prepare data
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        const dataToUpdate = {
            firstName: firstName, // บันทึก first name แยก
            lastName: lastName,   // บันทึก last name แยก
            healthPoints: newPoints,
            consecutiveDays: newDays,
            level: newLevel,
            exp: newExp, // บันทึก total EXP
            totalExerciseTime: newTotalTime, // บันทึก total exercise time
            lastExerciseDate: today,
            exerciseStreak: newDays,
            photoSubmitted: true,
            lastSubmissionTime: now.toISOString(),
            lastExerciseType: selectedExerciseType,
            lastExerciseIcon: selectedExerciseIcon
        };

        // Compress image for Google Sheets
        if (submitButton) {
            submitButton.innerHTML = '<span>กำลังบีบอัดรูปภาพ...</span>';
        }
        
        const compressedImage = await compressImage(currentPhotoData.base64, 400, 0.5);

        const sheetData = {
            timestamp: now.toISOString(),
            date: today,
            time: now.toLocaleTimeString('th-TH'),
            firstName: firstName,
            lastName: lastName,
            fullName: displayName,
            exerciseTime: exerciseTime,
            totalExerciseTime: newTotalTime, // Include total exercise time in sheet
            exerciseType: selectedExerciseType,
            exerciseIcon: selectedExerciseIcon,
            healthPoints: newPoints,
            consecutiveDays: newDays,
            level: newLevel,
            exp: newExp,
            hasPhoto: 'Yes',
            image: compressedImage,
            imageFilename: currentPhotoData.filename,
            imageSize: currentPhotoData.size,
            imageType: currentPhotoData.type,
            submissionStatus: 'Success',
            notes: `Exercise: ${selectedExerciseType} (${exerciseTime} min), Total Time: ${newTotalTime} min, Level: ${newLevel}, EXP: ${newExp}, Photo: ${currentPhotoData.filename}, Name: ${firstName} ${lastName}`
        };

        console.log('Data prepared:', { dataToUpdate, newExp, newLevel, currentLevel, firstName, lastName, displayName, exerciseType: selectedExerciseType, newTotalTime });

        // Step 1: Save to Firestore
        if (submitButton) {
            submitButton.innerHTML = '<span>กำลังบันทึกในแอป...</span>';
        }
        
        await saveUserData(dataToUpdate);
        console.log("✅ Firestore save successful");

        // Step 2: Try to send to Google Sheets
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
            
            if (sheetsError.message.includes('timeout')) {
                showNotification('บันทึกในแอปสำเร็จ! แต่การส่งไป Google Sheets ใช้เวลานานเกินไป', 'warning');
            } else if (sheetsError.message.includes('Network Error')) {
                showNotification('บันทึกในแอปสำเร็จ! แต่ไม่สามารถเชื่อมต่อ Google Sheets ได้ในขณะนี้', 'warning');
            } else {
                showNotification(`บันทึกในแอปสำเร็จ! ปัญหา Google Sheets: ${sheetsError.message}`, 'warning');
            }
        }

        // Update UI with new values
        const exerciseStatusElement = document.getElementById('exerciseStatus');
        if (exerciseStatusElement) {
            exerciseStatusElement.textContent = 'วันนี้คุณส่งผลแล้ว ✅';
            exerciseStatusElement.classList.add('text-green-600');
        }
        
        // Animate UI updates
        animatePointIncrease('totalPoints', currentPoints, newPoints);
        animatePointIncrease('healthPoints', currentPoints, newPoints);
        document.getElementById('consecutiveDays').textContent = newDays;
        
        // Update total exercise time
        totalExerciseTimeMinutes = newTotalTime;
        updateTotalExerciseTimeDisplay();
        
        // Update EXP display
        updateExpDisplay(newExp, newLevel);
        
        // Check for level up
        if (newLevel > currentLevel) {
            document.getElementById('userLevel').textContent = newLevel;
            if (window.renderLevelStars) {
                renderLevelStars('levelStarsMain', newLevel);
                renderLevelStars('levelStarsPopup', newLevel);
            }
            
            if (isMaxLevel(newLevel)) {
                showNotification(`🎊 ยินดีด้วย! คุณถึงเลเวลสูงสุด (เลเวล ${newLevel})!`, 'success');
            } else {
                showNotification(`ยินดีด้วย! คุณเลื่อนขึ้นสู่เลเวล ${newLevel}!`, 'success');
            }
        }
        
        // Final success message
        if (sheetsSuccess) {
            showNotification(`ส่งข้อมูลสำเร็จทั้งในแอปและ Google Sheets! ได้รับ +${pointGain} แต้ม, +${expGain} EXP, +${exerciseTime} นาทีรวม (รวมรูปภาพ) - ${selectedExerciseType}`, 'success');
        } else {
            showNotification(`บันทึกในแอปสำเร็จ! ได้รับ +${pointGain} แต้ม, +${expGain} EXP, +${exerciseTime} นาทีรวม (Google Sheets จะอัพเดทภายหลัง) - ${selectedExerciseType}`, 'success');
        }
        
        // Clear data and disable submit button
        currentPhotoData = null;
        selectedExerciseType = '';
        selectedExerciseIcon = '';
        clearExerciseSelection();
        
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

// Compress image function
function compressImage(base64Data, maxWidth = 400, quality = 0.6) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            let { width, height } = img;
            
            // Calculate new dimensions while maintaining aspect ratio
            const aspectRatio = width / height;
            
            if (width > height) {
                // Landscape orientation
                if (width > maxWidth) {
                    width = maxWidth;
                    height = Math.round(maxWidth / aspectRatio);
                }
            } else {
                // Portrait orientation
                const maxHeight = maxWidth;
                if (height > maxHeight) {
                    height = maxHeight;
                    width = Math.round(maxHeight * aspectRatio);
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Enable image smoothing for better quality at smaller sizes
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw the resized image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to JPEG with specified quality for better compression
            let compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            
            // If still too large, reduce quality further
            let attempts = 0;
            const maxAttempts = 5;
            const targetSizeKB = 100; // Target 100KB max
            
            while (compressedBase64.length > targetSizeKB * 1365 && attempts < maxAttempts && quality > 0.1) {
                quality -= 0.1;
                compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                attempts++;
            }
            
            // If still too large, reduce dimensions further
            if (compressedBase64.length > targetSizeKB * 1365 && attempts >= maxAttempts) {
                width = Math.round(width * 0.8);
                height = Math.round(height * 0.8);
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
            }
            
            const originalSizeKB = Math.round(base64Data.length / 1365); // Approximate KB
            const compressedSizeKB = Math.round(compressedBase64.length / 1365); // Approximate KB
            const compressionRatio = Math.round((1 - compressedSizeKB / originalSizeKB) * 100);
            
            console.log(`Image compression complete:`);
            console.log(`- Original: ${originalSizeKB}KB`);
            console.log(`- Compressed: ${compressedSizeKB}KB (${compressionRatio}% reduction)`);
            console.log(`- Dimensions: ${width}x${height}`);
            console.log(`- Quality: ${Math.round(quality * 100)}%`);
            
            resolve(compressedBase64);
        };
        
        img.onerror = function() {
            console.error('Failed to load image for compression');
            resolve(base64Data); // Return original if compression fails
        };
        
        img.src = base64Data;
    });
}

// Send data to Sheet.best
async function sendToSheetBest(data, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;
    
    try {
        console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES + 1} - Sending to Sheet.best`);
        
        if (!SHEET_BEST_URL || !SHEET_BEST_URL.startsWith('https://sheet.best/api/sheets/')) {
            throw new Error('Sheet.best URL ไม่ถูกต้อง');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 30000);

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

        const response = await fetch(SHEET_BEST_URL, fetchOptions);
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseText = await response.text();
        let result;
        try {
            result = responseText ? JSON.parse(responseText) : { success: true };
        } catch (parseError) {
            if (response.ok) {
                return {
                    success: true,
                    message: 'Data sent successfully to Google Sheets'
                };
            }
        }
        
        return result || { success: true, message: 'Data sent successfully' };
        
    } catch (error) {
        console.error(`Sheet.best attempt ${retryCount + 1} failed:`, error);
        
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
        }

        if (shouldRetry && retryCount < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return sendToSheetBest(data, retryCount + 1);
        }

        const finalError = new Error(`${errorMessage} (หลังจากลอง ${retryCount + 1} ครั้ง)`);
        finalError.originalError = error;
        throw finalError;
    }
}

// Utility functions
function showNotification(message, type, subtext = '') {
    console.log(`${type.toUpperCase()}: ${message}${subtext ? ' - ' + subtext : ''}`);
    
    if (window.showNotification) {
        window.showNotification(message, type, subtext);
    } else {
        alert(message);
    }
}

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

function removePhoto() {
    currentPhotoData = null;
    document.getElementById('photoPreview').classList.add('hidden');
    document.getElementById('uploadPlaceholder').classList.remove('hidden');
    document.getElementById('previewImage').src = '';
    
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.value = '';
    }
    
    showNotification('ลบรูปภาพแล้ว', 'info');
}

// Check submission status when page loads
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
                if (exerciseStatusElement) {
                    exerciseStatusElement.textContent = 'วันนี้คุณส่งผลแล้ว ✅';
                    exerciseStatusElement.classList.add('text-green-600');
                }
                
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.classList.add('opacity-50', 'cursor-not-allowed');
                    submitButton.innerHTML = '<span class="text-2xl">✅</span><span>ส่งข้อมูลแล้วจ้า</span>';
                }
                
                disablePhotoButtons();
            } else {
                if (exerciseStatusElement) {
                    exerciseStatusElement.textContent = 'คุณยังไม่ออกกำลังกาย';
                    exerciseStatusElement.classList.remove('text-green-600');
                }
            }
        }
    } catch (error) {
        console.error("Error checking submission status:", error);
    }
}

// Logout function
async function quickLogout() {
    try {
        if (auth && auth.currentUser) {
            await auth.signOut();
            console.log('User signed out successfully');
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error signing out:', error);
        alert('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
}

// Initialize when auth state changes
window.addEventListener('load', () => {
    // Wait a bit for Firebase auth to be ready
    setTimeout(() => {
        if (auth.currentUser) {
            loadUserData();
            checkSubmissionStatus();
        }
    }, 1000);
});

// Make functions available globally
window.selectExerciseType = selectExerciseType;
window.clearExerciseSelection = clearExerciseSelection;
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
window.loadUserData = loadUserData;
window.renderLevelStars = renderLevelStars;
window.quickLogout = quickLogout;
window.updateTotalExerciseTimeDisplay = updateTotalExerciseTimeDisplay;
window.formatExerciseTime = formatExerciseTime;

// Debug function for testing with total exercise time
window.debugSheetBest = async function() {
    console.log('=== Debug Sheet.best Connection with Total Exercise Time ===');
    console.log('URL:', SHEET_BEST_URL);
    console.log('Online:', navigator.onLine);
    console.log('Selected Exercise Type:', selectedExerciseType);
    console.log('Selected Exercise Icon:', selectedExerciseIcon);
    console.log('Total Exercise Time:', totalExerciseTimeMinutes, 'minutes');
    
    if (SHEET_BEST_URL.includes('YOUR_SHEET_ID_HERE')) {
        console.log('❌ กรุณาแทนที่ SHEET_BEST_URL ด้วย URL จริงจาก Sheet.best');
        return;
    }
    
    // Test the new EXP system with total exercise time
    console.log('=== Testing Progressive EXP System with Total Exercise Time ===');
    const testExpValues = [0, 20, 40, 50, 100, 150, 180, 250, 320, 400, 500, 600];
    
    testExpValues.forEach(exp => {
        const level = calculateLevel(exp);
        const levelExp = getExpInCurrentLevel(exp);
        const expNeeded = getExpNeededForNextLevel(exp);
        const maxExp = getCurrentLevelMaxExp(level);
        const isMax = isMaxLevel(level);
        
        console.log(`EXP ${exp}: Level ${level}, Current Level EXP: ${levelExp}/${maxExp}, Need: ${expNeeded}, Max: ${isMax}`);
    });
    
    // Get current user info for debugging
    const userData = await getUserData();
    const currentDisplayName = getDisplayName(userData);
    const currentFirstName = getFirstName(userData);
    const currentLastName = getLastName(userData);
    const currentTotalTime = userData?.totalExerciseTime || 0;
    
    console.log('Current Display Name:', currentDisplayName);
    console.log('Current First Name:', currentFirstName);
    console.log('Current Last Name:', currentLastName);
    console.log('Current Total Exercise Time:', currentTotalTime, 'minutes');
    console.log('Auth User:', auth.currentUser?.email, auth.currentUser?.displayName);
    console.log('User Data:', userData);
    
    // Create a small test image
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 1, 1);
    const testImageBase64 = canvas.toDataURL('image/png');
    
    console.log('✅ Testing data send with Total Exercise Time...');
    try {
        const testExerciseTime = 45; // Test with 45 minutes
        const testNewTotalTime = currentTotalTime + testExerciseTime;
        
        const testData = {
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('th-TH'),
            firstName: currentFirstName + ' (ทดสอบ)',
            lastName: currentLastName + ' (ระบบ)',
            fullName: currentDisplayName + ' (ทดสอบระบบ)',
            exerciseTime: testExerciseTime,
            totalExerciseTime: testNewTotalTime, // Test total time tracking
            exerciseType: 'วิ่ง (ทดสอบ)',
            exerciseIcon: '🏃‍♂️',
            healthPoints: 5,
            consecutiveDays: 1,
            level: 0,
            exp: 5,
            hasPhoto: 'Yes',
            image: testImageBase64,
            imageFilename: 'test-total-time.png',
            imageSize: testImageBase64.length,
            imageType: 'image/png',
            submissionStatus: 'Test Total Exercise Time',
            notes: `Testing Total Exercise Time System - ${currentFirstName} ${currentLastName} - Exercise: วิ่ง (${testExerciseTime} min) - Previous Total: ${currentTotalTime} min → New Total: ${testNewTotalTime} min`
        };
        
        const result = await sendToSheetBest(testData);
        console.log('✅ Test send with Total Exercise Time successful:', result);
        alert(`การทดสอบ Total Exercise Time สำเร็จ!\nประเภทการออกกำลังกาย: วิ่ง 🏃‍♂️\nเวลาครั้งนี้: ${testExerciseTime} นาที\nเวลารวมเก่า: ${currentTotalTime} นาที\nเวลารวมใหม่: ${testNewTotalTime} นาที\nตรวจสอบ Google Sheet ของคุณ`);
    } catch (error) {
        console.log('❌ Test send failed:', error);
        alert(`การทดสอบล้มเหลว: ${error.message}`);
    }
};