/**
 * Google Apps Script Web App for Anki Card App Cross-Device Sync
 * 
 * 📌 Instructions:
 * 1. Open your Google Sheet.
 * 2. Click "Extensions" -> "Apps Script".
 * 3. Clear any existing code and paste this script in the editor.
 * 4. Click the Save icon (floppy disk).
 * 5. Click "Deploy" -> "New Deployment".
 * 6. Click the gear icon (Select type) and choose "Web App".
 * 7. Set:
 *    - Description: "Anki Sync Web App"
 *    - Execute as: "Me" (your-email@gmail.com)
 *    - Who has access: "Anyone" (⚠️ Crucial: This allows your phone to write sync data without OAuth login).
 * 8. Click "Deploy". Authorize permissions if prompted (Go to Advanced -> Go to Untitled project (unsafe)).
 * 9. Copy the "Web App URL" (ends with /exec).
 * 10. Paste this URL into the Admin panel -> Settings tab -> "Google Apps Script URL" in your app.
 */

function doGet(e) {
  return ContentService.createTextOutput("Anki Sync Server is running! Use POST to sync data.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  // CORS support
  var origin = "*";
  
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Save Assignments
    if (action === 'saveAssignments') {
      var sheet = ss.getSheetByName('Assignments');
      if (!sheet) {
        sheet = ss.insertSheet('Assignments');
        sheet.appendRow(['User', 'Deck', 'Enabled', 'Order']);
      } else {
        sheet.clearContents();
        sheet.appendRow(['User', 'Deck', 'Enabled', 'Order']);
      }
      
      var assignments = payload.assignments; // Array of { user, deck, enabled, order }
      if (assignments && assignments.length > 0) {
        var rows = assignments.map(function(a) {
          return [a.user, a.deck, a.enabled ? 'TRUE' : 'FALSE', a.order];
        });
        sheet.getRange(2, 1, rows.length, 4).setValues(rows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', origin);
    }
    
    // 2. Save Progress (SRS Memory)
    if (action === 'saveProgress') {
      var sheet = ss.getSheetByName('Progress');
      if (!sheet) {
        sheet = ss.insertSheet('Progress');
        sheet.appendRow(['User', 'Word', 'Interval', 'EaseFactor', 'Reviews', 'NextReview', 'LastAnswer']);
      }
      
      var user = payload.user;
      var progressList = payload.progress; // Array of { word, interval, easeFactor, reviews, nextReview, lastAnswer }
      
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var newRows = [];
      newRows.push(headers);
      
      // Filter out old records for this user
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] !== user) {
          newRows.push(data[i]);
        }
      }
      
      // Append new progress records for this user
      if (progressList && progressList.length > 0) {
        progressList.forEach(function(p) {
          newRows.push([user, p.word, p.interval, p.easeFactor, p.reviews, p.nextReview, p.lastAnswer || '']);
        });
      }
      
      sheet.clearContents();
      sheet.getRange(1, 1, newRows.length, 7).setValues(newRows);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', origin);
    }
    
    // 3. Save User PIN
    if (action === 'savePin') {
      var sheet = ss.getSheetByName('Users');
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        var userId = payload.userId;
        var pinHash = payload.pinHash;
        var found = false;
        
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] === userId) {
            sheet.getRange(i + 1, 5).setValue(pinHash); // Assuming A=id, B=name, C=role, D=photoUrl, E=pinhash
            found = true;
            break;
          }
        }
        
        // If user not in spreadsheet, create row
        if (!found) {
          var nameMap = { brother1: "哥哥", brother2: "弟弟", mom: "媽媽", dad: "爸爸" };
          var role = (userId === "mom" || userId === "dad") ? "admin" : "learner";
          sheet.appendRow([userId, nameMap[userId] || userId, role, "", pinHash]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', origin);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', origin);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', origin);
  }
}
