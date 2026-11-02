const express = require('express');
const staffController = require('../controllers/staff.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../validators/common');
const { validateCreateTrip, validateUpdateTrip } = require('../validators/trip.validator');
const { validateCreateIncident } = require('../validators/incident.validator');

const router = express.Router();

// Enforce authentication & STAFF / ADMIN role
router.use(authenticate(), authorize('STAFF', 'ADMIN'));

// --- Staff Dashboard ---
router.get('/dashboard', staffController.getDashboard);

// --- Operational Vehicles ---
router.get('/vehicles', staffController.getVehicles);
router.get('/vehicles/:id', staffController.getVehicleById);

// --- Trips Management ---
router.get('/trips', staffController.getTrips);
router.post('/trips', validateBody(validateCreateTrip), staffController.createTrip);
router.get('/trips/:id', staffController.getTripById);
router.patch('/trips/:id', validateBody(validateUpdateTrip), staffController.updateTrip);

// --- Incidents Reporting ---
router.get('/incidents', staffController.getIncidents);
router.post('/incidents', validateBody(validateCreateIncident), staffController.createIncident);
router.get('/incidents/:id', staffController.getIncidentById);

module.exports = router;
