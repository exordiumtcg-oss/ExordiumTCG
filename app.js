const CONFIG = {
  SHEET_ID: '1reGPAmWECa9M9s-Pujfp1fO-DHoGmU_msZFCm2TLwq8',
  SECRET_KEY: 'EXOEXO',
  USERS_SHEET: 'Users',
  OWNED_SHEET: 'Owned',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: '12345678'
};


/* =========================
   BASIC HELPERS
========================= */

function getDB() {
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

function getUsersSheet() {
  return getDB().getSheetByName(CONFIG.USERS_SHEET);
}

function getOwnedSheet() {
  return getDB().getSheetByName(CONFIG.OWNED_SHEET);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function hashPassword(password) {
  const signature = Utilities.computeHmacSha256Signature(
    String(password),
    CONFIG.SECRET_KEY
  );

  return signature
    .map(function(byte) {
      const value = (byte < 0 ? byte + 256 : byte).toString(16);
      return value.length === 1 ? '0' + value : value;
    })
    .join('');
}


/* =========================
   INITIAL SETUP
========================= */

function setupDatabase() {
  const ss = getDB();

  let users = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (!users) {
    users = ss.insertSheet(CONFIG.USERS_SHEET);
  }

  if (users.getLastRow() === 0) {
    users.appendRow([
      'Username',
      'Name',
      'Email',
      'Phone',
      'Password Hash',
      'Role',
      'Created At',
      'Status'
    ]);
  }

  let owned = ss.getSheetByName(CONFIG.OWNED_SHEET);
  if (!owned) {
    owned = ss.insertSheet(CONFIG.OWNED_SHEET);
  }

  if (owned.getLastRow() === 0) {
    owned.appendRow([
      'Username',
      'Set Name',
      'Card ID',
      'Owned',
      'Updated At'
    ]);
  }

  createAdmin();

  return 'Database setup complete.';
}


/* =========================
   ADMIN
========================= */

function createAdmin() {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (normalize(data[i][0]) === normalize(CONFIG.ADMIN_USERNAME)) {
      return;
    }
  }

  sheet.appendRow([
    CONFIG.ADMIN_USERNAME,
    'EXORDIUM Administrator',
    '',
    '',
    hashPassword(CONFIG.ADMIN_PASSWORD),
    'admin',
    new Date(),
    'active'
  ]);
}


/* =========================
   REGISTER
========================= */

function registerUser(data) {
  const username = String(data.username || '').trim();
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim();
  const phone = String(data.phone || '').trim();
  const password = String(data.password || '');
  const confirmPassword = String(data.confirmPassword || '');

  if (!username || !name || !email || !phone || !password) {
    return {
      success: false,
      message: 'All fields are required.'
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      message: 'Passwords do not match.'
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message: 'Password must contain at least 8 characters.'
    };
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return {
      success: false,
      message: 'Username contains invalid characters.'
    };
  }

  const sheet = getUsersSheet();
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const existingUsername = normalize(rows[i][0]);
    const existingEmail = normalize(rows[i][2]);
    const existingPhone = normalize(rows[i][3]);

    if (existingUsername === normalize(username)) {
      return {
        success: false,
        message: 'Username already exists.'
      };
    }

    if (existingEmail === normalize(email)) {
      return {
        success: false,
        message: 'Email already exists.'
      };
    }

    if (existingPhone === normalize(phone)) {
      return {
        success: false,
        message: 'Phone number already exists.'
      };
    }
  }

  sheet.appendRow([
    username,
    name,
    email,
    phone,
    hashPassword(password),
    'user',
    new Date(),
    'active'
  ]);

  return {
    success: true,
    message: 'Registration successful.'
  };
}


/* =========================
   LOGIN
========================= */

function loginUser(data) {
  const identifier = normalize(data.identifier);
  const password = String(data.password || '');

  if (!identifier || !password) {
    return {
      success: false,
      message: 'Please enter your login information.'
    };
  }

  const sheet = getUsersSheet();
  const rows = sheet.getDataRange().getValues();
  const passwordHash = hashPassword(password);

  for (let i = 1; i < rows.length; i++) {

    const username = normalize(rows[i][0]);
    const email = normalize(rows[i][2]);
    const phone = normalize(rows[i][3]);
    const storedHash = String(rows[i][4]);
    const role = String(rows[i][5] || 'user');
    const status = normalize(rows[i][7]);

    const identifierMatches =
      identifier === username ||
      identifier === email ||
      identifier === phone;

    if (identifierMatches) {

      if (status !== 'active') {
        return {
          success: false,
          message: 'This account is not active.'
        };
      }

      if (storedHash !== passwordHash) {
        return {
          success: false,
          message: 'Incorrect password.'
        };
      }

      const token = Utilities.getUuid();

      CacheService
        .getScriptCache()
        .put(
          'SESSION_' + token,
          JSON.stringify({
            username: rows[i][0],
            name: rows[i][1],
            role: role
          }),
          21600
        );

      return {
        success: true,
        token: token,
        user: {
          username: rows[i][0],
          name: rows[i][1],
          role: role
        }
      };
    }
  }

  return {
    success: false,
    message: 'Account not found.'
  };
}


/* =========================
   SESSION
========================= */

function getSession(token) {
  if (!token) {
    return null;
  }

  const data = CacheService
    .getScriptCache()
    .get('SESSION_' + token);

  if (!data) {
    return null;
  }

  return JSON.parse(data);
}

function logoutUser(token) {
  if (token) {
    CacheService
      .getScriptCache()
      .remove('SESSION_' + token);
  }

  return {
    success: true
  };
}


/* =========================
   GET CARD SETS
========================= */

function getSets() {
  const ss = getDB();
  const sheets = ss.getSheets();

  const sets = [];

  sheets.forEach(function(sheet) {

    const name = sheet.getName();

    if (
      name === CONFIG.USERS_SHEET ||
      name === CONFIG.OWNED_SHEET
    ) {
      return;
    }

    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      return;
    }

    const headers = data[0].map(function(h) {
      return String(h).trim();
    });

    sets.push({
      name: name,
      totalCards: data.length - 1,
      headers: headers
    });
  });

  return sets;
}


/* =========================
   GET CARDS FROM SET
========================= */

function getCards(setName, token) {

  const session = getSession(token);

  if (!session) {
    return {
      success: false,
      message: 'Session expired.'
    };
  }

  const sheet = getDB().getSheetByName(setName);

  if (!sheet) {
    return {
      success: false,
      message: 'Set not found.'
    };
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return {
      success: true,
      cards: []
    };
  }

  const headers = values[0].map(function(h) {
    return String(h).trim();
  });

  const cards = [];

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    if (row.join('').trim() === '') {
      continue;
    }

    const card = {};

    headers.forEach(function(header, index) {
      card[header] = row[index];
    });

    cards.push(card);
  }

  return {
    success: true,
    setName: setName,
    cards: cards
  };
}


/* =========================
   OWNED STATUS
========================= */

function getOwnedCards(token, setName) {

  const session = getSession(token);

  if (!session) {
    return {
      success: false,
      message: 'Session expired.'
    };
  }

  const sheet = getOwnedSheet();
  const rows = sheet.getDataRange().getValues();

  const owned = {};

  for (let i = 1; i < rows.length; i++) {

    const username = normalize(rows[i][0]);
    const currentSet = String(rows[i][1]);
    const cardID = String(rows[i][2]);
    const status = rows[i][3];

    if (
      username === normalize(session.username) &&
      currentSet === setName
    ) {
      owned[cardID] =
        status === true ||
        normalize(status) === 'true';
    }
  }

  return {
    success: true,
    owned: owned
  };
}


function setOwned(token, setName, cardID, owned) {

  const session = getSession(token);

  if (!session) {
    return {
      success: false,
      message: 'Session expired.'
    };
  }

  const sheet = getOwnedSheet();
  const rows = sheet.getDataRange().getValues();

  const username = session.username;
  const normalizedUsername = normalize(username);

  for (let i = 1; i < rows.length; i++) {

    if (
      normalize(rows[i][0]) === normalizedUsername &&
      String(rows[i][1]) === String(setName) &&
      String(rows[i][2]) === String(cardID)
    ) {

      sheet.getRange(i + 1, 4).setValue(Boolean(owned));
      sheet.getRange(i + 1, 5).setValue(new Date());

      return {
        success: true
      };
    }
  }

  sheet.appendRow([
    username,
    setName,
    cardID,
    Boolean(owned),
    new Date()
  ]);

  return {
    success: true
  };
}


/* =========================
   COLLECTION SUMMARY
========================= */

function getCollectionSummary(token, setName) {

  const session = getSession(token);

  if (!session) {
    return {
      success: false,
      message: 'Session expired.'
    };
  }

  const sheet = getDB().getSheetByName(setName);

  if (!sheet) {
    return {
      success: false,
      message: 'Set not found.'
    };
  }

  const totalCards = Math.max(sheet.getLastRow() - 1, 0);

  const ownedResult = getOwnedCards(token, setName);

  if (!ownedResult.success) {
    return ownedResult;
  }

  let ownedCount = 0;

  Object.keys(ownedResult.owned).forEach(function(cardID) {
    if (ownedResult.owned[cardID]) {
      ownedCount++;
    }
  });

  const percentage =
    totalCards === 0
      ? 0
      : (ownedCount / totalCards) * 100;

  return {
    success: true,
    totalCards: totalCards,
    ownedCards: ownedCount,
    percentage: Number(percentage.toFixed(2))
  };
}


/* =========================
   ADMIN FUNCTIONS
========================= */

function requireAdmin(token) {

  const session = getSession(token);

  if (!session || session.role !== 'admin') {
    return null;
  }

  return session;
}


function getUserList(token) {

  const admin = requireAdmin(token);

  if (!admin) {
    return {
      success: false,
      message: 'Admin access required.'
    };
  }

  const sheet = getUsersSheet();
  const rows = sheet.getDataRange().getValues();

  const users = [];

  for (let i = 1; i < rows.length; i++) {

    users.push({
      username: rows[i][0],
      name: rows[i][1],
      email: rows[i][2],
      phone: rows[i][3],
      role: rows[i][5],
      createdAt: rows[i][6],
      status: rows[i][7]
    });
  }

  return {
    success: true,
    users: users
  };
}


function resetUserPassword(token, username, newPassword) {

  const admin = requireAdmin(token);

  if (!admin) {
    return {
      success: false,
      message: 'Admin access required.'
    };
  }

  if (!newPassword || newPassword.length < 8) {
    return {
      success: false,
      message: 'Password must contain at least 8 characters.'
    };
  }

  const sheet = getUsersSheet();
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {

    if (normalize(rows[i][0]) === normalize(username)) {

      sheet
        .getRange(i + 1, 5)
        .setValue(hashPassword(newPassword));

      return {
        success: true,
        message: 'Password reset successfully.'
      };
    }
  }

  return {
    success: false,
    message: 'User not found.'
  };
}


function deleteUser(token, username) {

  const admin = requireAdmin(token);

  if (!admin) {
    return {
      success: false,
      message: 'Admin access required.'
    };
  }

  if (normalize(username) === normalize(CONFIG.ADMIN_USERNAME)) {
    return {
      success: false,
      message: 'The admin account cannot be deleted.'
    };
  }

  const sheet = getUsersSheet();
  const rows = sheet.getDataRange().getValues();

  for (let i = rows.length - 1; i >= 1; i--) {

    if (normalize(rows[i][0]) === normalize(username)) {

      sheet.deleteRow(i + 1);

      return {
        success: true,
        message: 'User deleted.'
      };
    }
  }

  return {
    success: false,
    message: 'User not found.'
  };
}


/* =========================
   API
========================= */

function doGet(e) {

  const action = e && e.parameter
    ? e.parameter.action
    : '';

  const token = e && e.parameter
    ? e.parameter.token
    : '';

  try {

    if (action === 'sets') {
      return jsonResponse({
        success: true,
        sets: getSets()
      });
    }

    if (action === 'cards') {
      return jsonResponse(
        getCards(
          e.parameter.setName,
          token
        )
      );
    }

    if (action === 'owned') {
      return jsonResponse(
        getOwnedCards(
          token,
          e.parameter.setName
        )
      );
    }

    if (action === 'summary') {
      return jsonResponse(
        getCollectionSummary(
          token,
          e.parameter.setName
        )
      );
    }

    if (action === 'users') {
      return jsonResponse(
        getUserList(token)
      );
    }

    return jsonResponse({
      success: false,
      message: 'Unknown action.'
    });

  } catch (error) {

    return jsonResponse({
      success: false,
      message: error.message
    });
  }
}


function doPost(e) {

  try {

    const data = JSON.parse(
      e.postData.contents
    );

    const action = data.action;

    if (action === 'register') {
      return jsonResponse(
        registerUser(data)
      );
    }

    if (action === 'login') {
      return jsonResponse(
        loginUser(data)
      );
    }

    if (action === 'logout') {
      return jsonResponse(
        logoutUser(data.token)
      );
    }

    if (action === 'setOwned') {
      return jsonResponse(
        setOwned(
          data.token,
          data.setName,
          data.cardID,
          data.owned
        )
      );
    }

    if (action === 'resetPassword') {
      return jsonResponse(
        resetUserPassword(
          data.token,
          data.username,
          data.newPassword
        )
      );
    }

    if (action === 'deleteUser') {
      return jsonResponse(
        deleteUser(
          data.token,
          data.username
        )
      );
    }

    return jsonResponse({
      success: false,
      message: 'Unknown action.'
    });

  } catch (error) {

    return jsonResponse({
      success: false,
      message: error.message
    });
  }
}
