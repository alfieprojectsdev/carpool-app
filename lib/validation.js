// lib/validation.js
// Every value that reaches the database or another resident's screen is
// checked here first. The database has matching CHECK constraints as a
// backstop, but a constraint violation would be a 500; these give a 400 with
// a message the form can show.

const CONTACT_METHODS = ['messenger', 'viber', 'phone', 'telegram'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const POST_TYPES = ['offer', 'request'];
const LOCATION_TYPES = ['residential', 'commercial', 'terminal'];

class ValidationError extends Error {}

function text(value, field, { max, required = false } = {}) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (required) throw new ValidationError(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text`);
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length > max) throw new ValidationError(`${field} must be at most ${max} characters`);
  return trimmed;
}

function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

function positiveInt(value, field) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(n) || n < 1) throw new ValidationError(`${field} is required`);
  return n;
}

function days(value) {
  if (!Array.isArray(value) || value.length === 0) throw new ValidationError('Pick at least one day');
  const unique = [...new Set(value)];
  for (const d of unique) oneOf(d, 'days_of_week', DAYS);
  return DAYS.filter((d) => unique.includes(d)); // Monday-first order
}

function time(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
    throw new ValidationError('departure_time must look like 07:30');
  }
  return value.slice(0, 5);
}

function seats(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new ValidationError('Available seats must be between 1 and 10');
  return n;
}

function contact(body) {
  return {
    name: text(body.name, 'Name', { max: 100, required: true }),
    contact_method: oneOf(body.contact_method, 'Contact method', CONTACT_METHODS),
    contact_info: text(body.contact_info, 'Contact info', { max: 100, required: true }),
  };
}

function newRide(body) {
  const ride = {
    ...contact(body),
    post_type: oneOf(body.post_type, 'Post type', POST_TYPES),
    origin_id: positiveInt(body.origin_id, 'Origin'),
    destination_id: positiveInt(body.destination_id, 'Destination'),
    days_of_week: days(body.days_of_week),
    departure_time: time(body.departure_time),
    notes: text(body.notes, 'Notes', { max: 500 }),
    vehicle_model: text(body.vehicle_model, 'Vehicle model', { max: 100 }),
    available_seats: seats(body.available_seats),
  };
  if (ride.origin_id === ride.destination_id) throw new ValidationError('Origin and destination must be different');
  if (ride.post_type === 'request') {
    ride.vehicle_model = null;
    ride.available_seats = null;
  }
  return ride;
}

/** Only the fields present in the body are validated and returned. */
function rideUpdate(body) {
  const update = {};
  if ('days_of_week' in body) update.days_of_week = days(body.days_of_week);
  if ('departure_time' in body) update.departure_time = time(body.departure_time);
  if ('notes' in body) update.notes = text(body.notes, 'Notes', { max: 500 });
  if ('vehicle_model' in body) update.vehicle_model = text(body.vehicle_model, 'Vehicle model', { max: 100 });
  if ('available_seats' in body) update.available_seats = seats(body.available_seats);
  return update;
}

function interest(body) {
  return {
    interested_name: text(body.interested_name, 'Name', { max: 100, required: true }),
    contact_method: oneOf(body.contact_method, 'Contact method', CONTACT_METHODS),
    contact_info: text(body.contact_info, 'Contact info', { max: 100, required: true }),
  };
}

function location(body) {
  return {
    location_name: text(body.location_name, 'Location name', { max: 60, required: true }),
    location_type: LOCATION_TYPES.includes(body.location_type) ? body.location_type : 'commercial',
  };
}

module.exports = { ValidationError, newRide, rideUpdate, interest, location, DAYS };
