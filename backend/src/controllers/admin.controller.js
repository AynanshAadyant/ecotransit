const staffService = require('../services/staff.service');
const vehicleService = require('../services/vehicle.service');
const routeService = require('../services/route.service');
const stopService = require('../services/stop.service');
const incidentService = require('../services/incident.service');
const dashboardService = require('../services/dashboard.service');
const { successResponse } = require('../utils/response');

class AdminController {
  // --- Dashboard ---
  async getDashboard(req, res, next) {
    try {
      const metrics = await dashboardService.getAdminDashboardMetrics();
      return successResponse(res, metrics, 'Admin dashboard statistics retrieved');
    } catch (err) {
      next(err);
    }
  }

  // --- Staff Management ---
  async getStaff(req, res, next) {
    try {
      const staffList = await staffService.getAllStaff(req.query);
      return successResponse(res, staffList, 'Staff list retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getStaffById(req, res, next) {
    try {
      const staff = await staffService.getStaffById(req.params.id);
      return successResponse(res, staff, 'Staff member details retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createStaff(req, res, next) {
    try {
      const created = await staffService.createStaff(req.body);
      return successResponse(res, created, 'Staff account created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateStaff(req, res, next) {
    try {
      const updated = await staffService.updateStaff(req.params.id, req.body);
      return successResponse(res, updated, 'Staff account updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteStaff(req, res, next) {
    try {
      const result = await staffService.deleteStaff(req.params.id);
      return successResponse(res, result, 'Staff account deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  // --- Vehicles Management ---
  async getVehicles(req, res, next) {
    try {
      const vehicles = await vehicleService.getAllVehicles(req.query);
      return successResponse(res, vehicles, 'Vehicles retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getVehicleById(req, res, next) {
    try {
      const vehicle = await vehicleService.getVehicleById(req.params.id);
      return successResponse(res, vehicle, 'Vehicle details retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createVehicle(req, res, next) {
    try {
      const created = await vehicleService.createVehicle(req.body);
      return successResponse(res, created, 'Vehicle created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateVehicle(req, res, next) {
    try {
      const updated = await vehicleService.updateVehicle(req.params.id, req.body);
      return successResponse(res, updated, 'Vehicle updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteVehicle(req, res, next) {
    try {
      const result = await vehicleService.deleteVehicle(req.params.id);
      return successResponse(res, result, 'Vehicle deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  // --- Routes Management ---
  async getRoutes(req, res, next) {
    try {
      const routes = await routeService.getAllRoutes(req.query);
      return successResponse(res, routes, 'Routes retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getRouteById(req, res, next) {
    try {
      const route = await routeService.getRouteById(req.params.id);
      return successResponse(res, route, 'Route details retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createRoute(req, res, next) {
    try {
      const created = await routeService.createRoute(req.body);
      return successResponse(res, created, 'Route created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateRoute(req, res, next) {
    try {
      const updated = await routeService.updateRoute(req.params.id, req.body);
      return successResponse(res, updated, 'Route updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteRoute(req, res, next) {
    try {
      const result = await routeService.deleteRoute(req.params.id);
      return successResponse(res, result, 'Route deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  async setRouteStops(req, res, next) {
    try {
      const updated = await routeService.setRouteStops(req.params.id, req.body.stops || []);
      return successResponse(res, updated, 'Route stops updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // --- Stops Management ---
  async getStops(req, res, next) {
    try {
      const stops = await stopService.getAllStops(req.query);
      return successResponse(res, stops, 'Stops retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getStopById(req, res, next) {
    try {
      const stop = await stopService.getStopById(req.params.id);
      return successResponse(res, stop, 'Stop details retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createStop(req, res, next) {
    try {
      const created = await stopService.createStop(req.body);
      return successResponse(res, created, 'Stop created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateStop(req, res, next) {
    try {
      const updated = await stopService.updateStop(req.params.id, req.body);
      return successResponse(res, updated, 'Stop updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteStop(req, res, next) {
    try {
      const result = await stopService.deleteStop(req.params.id);
      return successResponse(res, result, 'Stop deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  // --- Incidents Management ---
  async getIncidents(req, res, next) {
    try {
      const incidents = await incidentService.getAllIncidents(req.query);
      return successResponse(res, incidents, 'Incidents retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateIncident(req, res, next) {
    try {
      const updated = await incidentService.updateIncident(req.params.id, req.body);
      return successResponse(res, updated, 'Incident updated successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
