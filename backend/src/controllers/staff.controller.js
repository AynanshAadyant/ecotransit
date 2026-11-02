const dashboardService = require('../services/dashboard.service');
const vehicleService = require('../services/vehicle.service');
const tripService = require('../services/trip.service');
const incidentService = require('../services/incident.service');
const { successResponse } = require('../utils/response');

class StaffController {
  // --- Dashboard ---
  async getDashboard(req, res, next) {
    try {
      const metrics = await dashboardService.getStaffDashboardMetrics(req.user);
      return successResponse(res, metrics, 'Staff dashboard operational data retrieved');
    } catch (err) {
      next(err);
    }
  }

  // --- Vehicles (Operational View) ---
  async getVehicles(req, res, next) {
    try {
      const vehicles = await vehicleService.getStaffVehicles();
      return successResponse(res, vehicles, 'Operational vehicles retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getVehicleById(req, res, next) {
    try {
      const vehicle = await vehicleService.getVehicleById(req.params.id);
      return successResponse(res, vehicle, 'Vehicle operational details retrieved');
    } catch (err) {
      next(err);
    }
  }

  // --- Trips Management ---
  async getTrips(req, res, next) {
    try {
      // By default, staff sees trips assigned to them or active trips
      const filters = { ...req.query };
      const trips = await tripService.getAllTrips(filters);
      return successResponse(res, trips, 'Trips retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getTripById(req, res, next) {
    try {
      const trip = await tripService.getTripById(req.params.id);
      return successResponse(res, trip, 'Trip details retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createTrip(req, res, next) {
    try {
      const created = await tripService.createTrip(req.body, req.user);
      return successResponse(res, created, 'Trip created/scheduled successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateTrip(req, res, next) {
    try {
      const updated = await tripService.updateTrip(req.params.id, req.body, req.user);
      return successResponse(res, updated, 'Trip updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // --- Incidents (Report & View) ---
  async getIncidents(req, res, next) {
    try {
      const incidents = await incidentService.getAllIncidents(req.query);
      return successResponse(res, incidents, 'Incidents retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getIncidentById(req, res, next) {
    try {
      const incident = await incidentService.getIncidentById(req.params.id);
      return successResponse(res, incident, 'Incident details retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createIncident(req, res, next) {
    try {
      const created = await incidentService.createIncident(req.body, req.user);
      return successResponse(res, created, 'Incident reported successfully', 201);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StaffController();
