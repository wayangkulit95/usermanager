const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Authentication Credentials for the management panel
const USERNAME = 'mts001'; // Replace with your username
const PASSWORD = 'mtsiptv0123'; // Replace with your password

// Telegram Bot Configuration
const NEW_USER_BOT_TOKEN = '7556738005:AAF5gSOorkX45rsy6CY7YN55angxI93qKlY'; // Replace with your new user bot token
const NEW_USER_CHAT_ID = '6715216418'; // Replace with your new user chat ID

const CONTENT_ACCESS_BOT_TOKEN = '8184128867:AAFuhwCs5JdumnKiTO3S0x1QXam9laH21h8'; // Replace with your content access bot token
const CONTENT_ACCESS_CHAT_ID = '6715216418'; // Replace with your content access chat ID

// Create SQLite Database
const db = new sqlite3.Database('./data.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Create Users Table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    code TEXT NOT NULL,
    expiration TEXT NOT NULL,
    allowedCountries TEXT NOT NULL,
    allowedDevices TEXT DEFAULT '',
    userAgent TEXT DEFAULT '',
    userId TEXT NOT NULL,
    userCode TEXT NOT NULL
);`);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key', // Replace with a secure key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set true if using HTTPS
}));

// Authentication Middleware
function isAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/login');
}

// Function to send notifications to Telegram
function sendTelegramNotification(token, chatId, message) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const data = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
    };

    fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
    }).catch(err => console.error('Error sending message to Telegram:', err));
}

// Render Login Form
app.get('/login', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login</title>
    </head>
    <body>
        <h1>Login</h1>
        <form action="/login" method="POST">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
            <br>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
            <br>
            <button type="submit">Login</button>
        </form>
    </body>
    </html>`;
    res.send(html);
});

// Handle Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === USERNAME && password === PASSWORD) {
        req.session.isAuthenticated = true;
        return res.redirect('/'); // Redirect to the user management page after successful login
    }

    res.status(401).send('Unauthorized - Invalid Credentials');
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error logging out');
        }
        res.redirect('/login');
    });
});

// User Management Routes (protected by isAuthenticated middleware)
app.get('/', isAuthenticated, (req, res) => {
    db.all('SELECT * FROM users', [], (err, users) => {
        if (err) {
            return res.status(500).send('Internal Server Error');
        }
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>IPTV User Management</title>
        </head>
        <body>
            <h1>IPTV User Management</h1>
            <h2>All Users</h2>
            <ul>
                ${users.map(user => `<li>${user.username} (Expires: ${user.expiration}) <form action="/delete/${user.id}" method="POST" style="display:inline;">
                    <button type="submit">Delete</button>
                </form></li>`).join('')}
            </ul>
            <a href="/add">Add New User</a>
            <br><a href="/logout">Logout</a>
        </body>
        </html>`;
        res.send(html);
    });
});

// Add User Form (protected by isAuthenticated middleware)
app.get('/add', isAuthenticated, (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Add User IPTV</title>
    </head>
    <body>
        <h1>Add New User</h1>
        <form action="/add" method="POST">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
            <br>
            <label for="code">Code:</label>
            <input type="text" id="code" name="code" required>
            <br>
            <label for="expiration">Expiration (DD-MM-YYYY):</label>
            <input type="date" id="expiration" name="expiration" required>
            <br>
            <label for="allowedCountries">Allowed Countries (comma-separated):</label>
            <input type="text" id="allowedCountries" name="allowedCountries" required>
            <br>
            <label for="userId">User ID:</label>
            <input type="text" id="userId" name="userId" required>
            <br>
            <label for="userCode">User Code:</label>
            <input type="text" id="userCode" name="userCode" required>
            <br>
            <button type="submit">Add User</button>
        </form>
        <br>
        <a href="/">Back to Users</a>
    </body>
    </html>`;
    res.send(html);
});

// Handle Add User (protected by isAuthenticated middleware)
app.post('/add', isAuthenticated, (req, res) => {
    const { username, code, expiration, allowedCountries, userId, userCode } = req.body;
    db.run('INSERT INTO users (username, code, expiration, allowedCountries, userId, userCode) VALUES (?, ?, ?, ?, ?, ?)',
        [username, code, expiration, allowedCountries, userId, userCode], function (err) {
            if (err) {
                return res.status(500).send('Internal Server Error');
            }

            // Send notification to Telegram for new user
            const message = `New User Created:\n- Username: <b>${username}</b>\n- Code: <b>${code}</b>\n- Expiration: <b>${expiration}</b>\n- Allowed Countries: <b>${allowedCountries}</b>`;
            sendTelegramNotification(NEW_USER_BOT_TOKEN, NEW_USER_CHAT_ID, message);

            res.redirect('/');
        });
});

// Delete User Route
app.post('/delete/:id', isAuthenticated, (req, res) => {
    const userId = req.params.id;
    db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
        if (err) {
            return res.status(500).send('Internal Server Error');
        }

        // Send notification to Telegram for user deletion
        const message = `User Deleted:\n- User ID: <b>${userId}</b>`;
        sendTelegramNotification(NEW_USER_BOT_TOKEN, NEW_USER_CHAT_ID, message);

        res.redirect('/');
    });
});

// Access Content Route
app.get('/id=:username/premium/code=:code', (req, res) => {
    const { username, code } = req.params;
    const userAgent = req.headers['user-agent'];
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // List of known desktop, mobile browsers, Linux, and sniffing tool user agents
    const browserAgents = [
        'Mozilla', 'Chrome', 'Safari', 'Firefox', 'Edge',   // Desktop browsers
        'Android', 'iPhone', 'iPad', 'Opera', 'Samsung',    // Mobile browsers
        'Mobile Safari', 'CriOS', 'FxiOS'                  // iOS Chrome and Firefox
    ];

    const sniffingAgents = [
        'curl', 'wget', 'PostmanRuntime', 'HttpClient', 'python-requests', // Known sniffing agents
        'Httpie', 'Apache-HttpClient', 'okhttp', 'Lynx'                   // More sniffing libraries
    ];

    const linuxAgents = [
        'X11; Linux', 'Linux x86_64', 'Ubuntu', 'Debian', 'Fedora', 'CentOS', // Common Linux distributions
        'Linux; Android', 'Linux; U'                                         // Android devices with Linux kernel
    ];

    // Check if the request is coming from a sniffing tool
    const isSniffingTool = sniffingAgents.some(agent => userAgent.includes(agent));

    // Check if the request is coming from a Linux environment
    const isLinux = linuxAgents.some(agent => userAgent.includes(agent));

    // Check if the request is coming from a browser (either desktop or mobile)
    const isBrowser = browserAgents.some(agent => userAgent.includes(agent));

    // Send notification if user tries to access via a browser
    if (isBrowser) {
        // Log the browser access attempt and notify via Telegram
        const browserAccessMessage = `
            🌐 Browser Access Detected! 🌐
            - Username: <b>${username || 'Unknown'}</b>
            - User Agent: <b>${userAgent}</b>
            - IP Address: <b>${ip}</b>
            - Access Time: <b>${new Date().toLocaleString()}</b>
        `;
        sendTelegramNotification(NEW_USER_BOT_TOKEN, NEW_USER_CHAT_ID, browserAccessMessage);

        // Redirect to a browser-specific page
        const browserRedirectUrl = 'https://i.ibb.co/bFsNJx8/redirect-browser.jpg'; // Replace with your URL
        return res.redirect(browserRedirectUrl);
    }

    if (isSniffingTool) {
        // Log the sniffing tool attempt and notify via Telegram
        const sniffingMessage = `
            🚨 Sniffing Tool Detected! 🚨
            - Username: <b>${username || 'Unknown'}</b>
            - User Agent: <b>${userAgent}</b>
            - IP Address: <b>${ip}</b>
            - Attempt Time: <b>${new Date().toLocaleString()}</b>
        `;
        sendTelegramNotification(NEW_USER_BOT_TOKEN, NEW_USER_CHAT_ID, sniffingMessage);

        // Redirect to a specific page for sniffing tool access attempts
        const sniffingRedirectUrl = 'https://i.ibb.co/N9WMFr5/SNIFF-PICTURE.jpg'; // Replace with your URL
        return res.redirect(sniffingRedirectUrl);
    }

    if (isLinux) {
        const linuxRedirectUrl = 'https://i.ibb.co/bFsNJx8/redirect-browser.jpg'; // Replace with your Linux redirect URL
        return res.redirect(linuxRedirectUrl);
    }

    // Proceed with the usual flow for non-browser devices
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err || !user) {
            return res.status(404).send('User not found');
        }

        // Check if the expiration date has passed
        const expirationDate = new Date(user.expiration);
        const currentDate = new Date();
        if (currentDate > expirationDate) {
            // Notify on Telegram about user expiration
            const expiredMessage = `
                User Expired:
                - Username: <b>${username}</b>
                - Expiration Date: <b>${user.expiration}</b>
                - IP Address: <b>${ip}</b>
                - Access Attempt Time: <b>${new Date().toLocaleString()}</b>
            `;
            sendTelegramNotification(NEW_USER_BOT_TOKEN, NEW_USER_CHAT_ID, expiredMessage);

            // Redirect to your specified expiration URL or return a response
            const redirectUrl = 'https://drive.google.com/uc?export=download&id=17tm4rNb8oLhwu3U0Jwq8Dn_bZXH4fUf6'; // Replace with your redirect URL for expired users
            return res.redirect(redirectUrl);
        }

        // Lock the URL to the first device
        let allowedDevices = JSON.parse(user.allowedDevices || '[]');
        if (!allowedDevices.length) {
            allowedDevices.push(userAgent);
            db.run('UPDATE users SET allowedDevices = ?, userAgent = ? WHERE username = ?', [JSON.stringify(allowedDevices), userAgent, username]);
        }

        // Check if the user agent matches the one stored for the user
        if (!allowedDevices.includes(userAgent)) {
            return res.status(403).send('Unauthorized - Device not allowed');
        }

        // Notify on Telegram about user access
        const accessMessage = `
            User Accessed Content:
            - Username: <b>${username}</b>
            - Code: <b>${user.code}</b>
            - Expiration Date: <b>${user.expiration}</b>
            - Allowed Countries: <b>${user.allowedCountries}</b>
            - IP Address: <b>${ip}</b>
            - User Agent: <b>${userAgent}</b>
            - Access Time: <b>${new Date().toLocaleString()}</b>
        `;
        sendTelegramNotification(CONTENT_ACCESS_BOT_TOKEN, CONTENT_ACCESS_CHAT_ID, accessMessage);

        // Fetch the content if the user is allowed, code matches, and expiration is valid
        const contentUrl = 'https://drive.google.com/uc?export=download&id=17gXmxMQ9aGcHRJvl_FVSf1sJqQtypTWG'; // Replace with your content URL
        res.redirect(contentUrl);
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});