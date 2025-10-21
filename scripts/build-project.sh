# 1. Create project folder
mkdir carpool-app && cd carpool-app

# 2. Initialize and install dependencies
npm init -y
npm install express pg dotenv
npm install --save-dev nodemon

# 3. Replace package.json with the one I provided above

# 4. Create the file structure
mkdir db routes public
touch .env server.js db/connection.js db/schema.sql routes/rides.js
touch public/index.html public/style.css

# 5. Set up PostgreSQL database
createdb carpool_db
psql carpool_db < db/schema.sql

# 6. Configure .env with your PostgreSQL credentials

# 7. Start the server
npm run dev