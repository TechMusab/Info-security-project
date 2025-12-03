# Troubleshooting - "Start Chat" Not Appearing

## Issue: No "Start Chat" button visible

### Possible Causes & Solutions:

### 1. Backend Server Not Running

**Check:**
- Is the server running on port 5000?
- Open http://localhost:5000/api/health in browser
- Should see: `{"status":"ok","timestamp":"..."}`

**Solution:**
```bash
cd server
npm run dev
```

### 2. No Users Registered Yet

**Solution:**
1. Register at least 2 users:
   - First user: "alice"
   - Second user: "bob"
2. Make sure both registrations complete successfully

### 3. User Search Not Working

**How to test:**
1. Type at least 2 characters in the search box
2. Wait for results
3. Check browser console (F12) for errors

**Common errors:**
- `Network Error` → Backend not running
- `401 Unauthorized` → Need to login again
- `404 Not Found` → API endpoint issue

### 4. Backend API Issue

**Test the API directly:**
```bash
# In browser or Postman
GET http://localhost:5000/api/auth/users/search?q=alice
```

Should return JSON array of users.

### 5. CORS Issues

**Check server/index.js:**
- Should have `app.use(cors());`
- Check browser console for CORS errors

### 6. Authentication Token Missing

**Solution:**
- Logout and login again
- Check if token is stored in localStorage
- Open browser DevTools → Application → Local Storage
- Should see `token` key

## Step-by-Step Debugging

1. **Check Backend:**
   ```bash
   cd server
   npm run dev
   # Should see: "Server running on port 5000"
   ```

2. **Check Frontend Console:**
   - Press F12
   - Go to Console tab
   - Look for errors when searching

3. **Test API Directly:**
   - Open: http://localhost:5000/api/auth/users/search?q=test
   - Should return JSON (even if empty array)

4. **Check Network Tab:**
   - F12 → Network tab
   - Search for a user
   - Check if request to `/api/auth/users/search` is made
   - Check response status and data

## Quick Fix Checklist

- [ ] Backend server is running (port 5000)
- [ ] At least 2 users are registered
- [ ] You are logged in
- [ ] Type at least 2 characters in search box
- [ ] No errors in browser console
- [ ] Network requests are successful (200 status)

## If Still Not Working

1. **Clear browser cache:**
   - Ctrl+Shift+Delete
   - Clear cache and cookies

2. **Restart everything:**
   ```bash
   # Stop all processes
   # Then:
   cd server
   npm run dev
   
   # New terminal:
   cd client
   npm start
   ```

3. **Check user object:**
   - In Dashboard component, add:
   ```javascript
   console.log('Current user:', user);
   console.log('Search results:', users);
   ```
   - Check browser console output

4. **Manual navigation test:**
   - Try navigating directly: http://localhost:3000/chat/USER_ID_HERE
   - Replace USER_ID_HERE with actual user ID from database

