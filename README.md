# Carpool App

A simple web application for coordinating carpools within the Phirst Park Homes community.

## Features

- **Browse Available Rides** - View all active carpool offers and requests
- **Post Rides** - Offer rides or request carpools with detailed schedule information
- **Route Matching** - Filter by common locations (Dau, Cubao, BGC, Manila, etc.)
- **Contact Integration** - Direct contact info for ride coordination (Messenger, Viber, Phone, Telegram)
- **Responsive Design** - Works on mobile and desktop

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Dev Tools**: nodemon for auto-restart

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/alfieprojectsdev/carpool-app.git
   cd carpool-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb -U ltpt420 carpool_db
   
   # Load schema
   psql carpool_db < db/schema.sql
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```bash
   DB_USER=ltpt420
   DB_HOST=localhost
   DB_NAME=carpool_db
   DB_PASSWORD=your_password
   DB_PORT=5432
   PORT=3000
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the app**
   
   Open your browser to: `http://localhost:3000`

## Project Structure

```
carpool-app/
├── db/
│   ├── connection.js    # PostgreSQL connection pool
│   └── schema.sql       # Database schema
├── routes/
│   └── rides.js         # Ride-related API endpoints
├── public/
│   ├── index.html       # Frontend UI
│   └── style.css        # Styles
├── server.js            # Express server entry point
├── package.json         # Dependencies
└── .env                 # Environment variables (not tracked)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rides` | List all active rides |
| GET | `/api/rides/:id` | Get single ride details |
| POST | `/api/rides` | Create new ride post |
| PUT | `/api/rides/:id` | Update ride post |
| DELETE | `/api/rides/:id` | Deactivate ride post |
| GET | `/api/locations` | Get all locations |
| POST | `/api/users` | Create new user |

## Database Schema

### Tables
- **users** - User profiles with contact information
- **locations** - Common pickup/dropoff locations
- **ride_posts** - Ride offers and requests

### Views
- **active_rides** - Denormalized view of active rides with user and location details

## Development

```bash
# Start with auto-reload
npm run dev

# Start production mode
npm start
```

## Troubleshooting

### "client password must be a string" error
- **Cause**: `DB_PASSWORD` set to empty string in `.env`
- **Fix**: Either remove `DB_PASSWORD` entirely (for peer auth) OR set it to actual password

### PostgreSQL connection failed
```bash
# Check if PostgreSQL is running
pg_isready

# Restart PostgreSQL if needed
sudo systemctl restart postgresql
```

### Reset database
```bash
dropdb carpool_db
createdb carpool_db
psql carpool_db < db/schema.sql
```

## Roadmap

- [ ] User authentication (login/signup)
- [ ] Edit/delete own posts
- [ ] Filter and search functionality
- [ ] Real-time notifications
- [ ] Mobile app version

## Contributing

This is a community project for Phirst Park Homes residents. Contributions welcome!

## License

MIT

## Author

Built as a learning project for community benefit.

## Acknowledgments

- Inspired by the carpool coordination needs in the Phirst Park Homes community
- Built with guidance from Claude (Anthropic)
