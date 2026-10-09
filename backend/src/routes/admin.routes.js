const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../validators/common');
const { validateCreateStaff, validateUpdateStaff } = require('../validators/staff.validator');
const { validateCreateVehicle, validateUpdateVehicle } = require('../validators/vehicle.validator');
const { validateCreateRoute, validateUpdateRoute, validateRouteStops } = require('../validators/route.validator');
const { validateCreateStop, validateUpdateStop } = require('../validators/stop.validator');
const { validateUpdateIncident } = require('../validators/incident.validator');

const router = express.Router();

// Enforce authentication & ADMIN role for all routes in this router
router.use(authenticate(), authorize('ADMIN'));

// --- Dashboard ---
router.get('/dashboard', adminController.getDashboard);

// --- Staff Management ---
router.get('/staff', adminController.getStaff);
router.post('/staff', validateBody(validateCreateStaff), adminController.createStaff);
router.get('/staff/:id', adminController.getStaffById);
router.patch('/staff/:id', validateBody(validateUpdateStaff), adminController.updateStaff);
router.delete('/staff/:id', adminController.deleteStaff);

// --- Vehicles Management ---
router.get('/vehicles', adminController.getVehicles);
router.post('/vehicles', validateBody(validateCreateVehicle), adminController.createVehicle);
router.get('/vehicles/:id', adminController.getVehicleById);
router.patch('/vehicles/:id', validateBody(validateUpdateVehicle), adminController.updateVehicle);
router.delete('/vehicles/:id', adminController.deleteVehicle);

// --- Routes Management ---
router.get('/routes', adminController.getRoutes);
router.post('/routes', validateBody(validateCreateRoute), adminController.createRoute);
router.get('/routes/:id', adminController.getRouteById);
router.patch('/routes/:id', validateBody(validateUpdateRoute), adminController.updateRoute);
router.delete('/routes/:id', adminController.deleteRoute);
router.post('/routes/:id/stops', validateBody(validateRouteStops), adminController.setRouteStops);

// --- Stops Management ---
router.get('/stops', adminController.getStops);
router.post('/stops', validateBody(validateCreateStop), adminController.createStop);
router.get('/stops/:id', adminController.getStopById);
router.patch('/stops/:id', validateBody(validateUpdateStop), adminController.updateStop);
router.delete('/stops/:id', adminController.deleteStop);

// --- Incidents Management ---
router.get('/incidents', adminController.getIncidents);
router.patch('/incidents/:id', validateBody(validateUpdateIncident), adminController.updateIncident);

module.exports = router;
