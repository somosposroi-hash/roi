import { Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'nubly_pos_access_super_secret_key_99';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'nubly_pos_refresh_super_secret_key_88';

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticates user and returns an Access Token in JSON, and sets Refresh Token in HttpOnly cookie.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Debe proporcionar usuario y contraseña'
        });
      }

      // Find user in database
      const user = await prisma.user.findUnique({
        where: { username }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Credenciales inválidas'
        });
      }

      // Check password hash
      const isPasswordValid = await bcryptjs.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Credenciales inválidas'
        });
      }

      // Generate Access Token (15 min)
      const accessToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          name: user.name,
          isAdmin: user.isAdmin,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Generate Refresh Token (7 days)
      const refreshToken = jwt.sign(
        { id: user.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Store Refresh Token in HttpOnly Cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      let allowedDeps: string[] = [];
      try {
        allowedDeps = JSON.parse(user.allowedDepartments || '[]');
      } catch (e) {
        allowedDeps = [];
      }

      let allowedFuncs: string[] = [];
      try {
        allowedFuncs = JSON.parse(user.allowedFunctions || '[]');
      } catch (e) {
        allowedFuncs = [];
      }

      // Send Response with User Info and Access Token
      return res.status(200).json({
        success: true,
        message: 'Sesión iniciada correctamente',
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          isAdmin: user.isAdmin,
          role: user.role || 'Administrador',
          imageUrl: user.imageUrl || '',
          allowedDepartments: allowedDeps,
          allowedFunctions: allowedFuncs,
          canConfigurePrinters: user.canConfigurePrinters !== false,
          canModifyManualRate: user.canModifyManualRate !== false,
          cashRegister: user.cashRegister || '',
          canViewOtherShifts: user.canViewOtherShifts !== false,
          canViewAllSales: user.canViewAllSales !== false,
          dashboardType: user.dashboardType || (user.role === 'Cajero' ? 'CAJERO' : 'ADMIN'),
          canRegisterExpenses: user.canRegisterExpenses !== false,
          canApplyDiscountOrSurcharge: user.canApplyDiscountOrSurcharge !== false,
          canSellOnCredit: user.canSellOnCredit !== false,
          canVoidSales: user.canVoidSales !== false
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/refresh
   * Receives the HttpOnly Refresh Token cookie, verifies it, and outputs a new Access Token.
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'No autorizado: Token de refresco ausente'
        });
      }

      // Verify the refresh token
      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      } catch (err) {
        return res.status(401).json({
          success: false,
          error: 'No autorizado: Token de refresco inválido o expirado'
        });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'No autorizado: Usuario no encontrado'
        });
      }

      // Generate new Access Token (15m)
      const accessToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          name: user.name,
          isAdmin: user.isAdmin,
          role: user.role
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      let allowedDeps: string[] = [];
      try {
        allowedDeps = JSON.parse(user.allowedDepartments || '[]');
      } catch (e) {
        allowedDeps = [];
      }

      let allowedFuncs: string[] = [];
      try {
        allowedFuncs = JSON.parse(user.allowedFunctions || '[]');
      } catch (e) {
        allowedFuncs = [];
      }

      return res.status(200).json({
        success: true,
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          isAdmin: user.isAdmin,
          role: user.role || 'Administrador',
          imageUrl: user.imageUrl || '',
          allowedDepartments: allowedDeps,
          allowedFunctions: allowedFuncs,
          canConfigurePrinters: user.canConfigurePrinters !== false,
          canModifyManualRate: user.canModifyManualRate !== false,
          cashRegister: user.cashRegister || '',
          canViewOtherShifts: user.canViewOtherShifts !== false,
          canViewAllSales: user.canViewAllSales !== false,
          dashboardType: user.dashboardType || (user.role === 'Cajero' ? 'CAJERO' : 'ADMIN'),
          canRegisterExpenses: user.canRegisterExpenses !== false,
          canApplyDiscountOrSurcharge: user.canApplyDiscountOrSurcharge !== false,
          canSellOnCredit: user.canSellOnCredit !== false,
          canVoidSales: user.canVoidSales !== false
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   * Clears the cookies.
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      return res.status(200).json({
        success: true,
        message: 'Sesión cerrada correctamente'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/users
   * Lists all users.
   */
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const sanitizedUsers = users.map(user => {
        let allowedDeps = [];
        let allowedFuncs = [];
        try { allowedDeps = JSON.parse(user.allowedDepartments || '[]'); } catch (e) {}
        try { allowedFuncs = JSON.parse(user.allowedFunctions || '[]'); } catch (e) {}

        return {
          id: user.id,
          username: user.username,
          name: user.name,
          isAdmin: user.isAdmin,
          role: user.role || 'Administrador',
          imageUrl: user.imageUrl || '',
          allowedDepartments: allowedDeps,
          allowedFunctions: allowedFuncs,
          canConfigurePrinters: user.canConfigurePrinters !== false,
          canModifyManualRate: user.canModifyManualRate !== false,
          cashRegister: user.cashRegister || '',
          canViewOtherShifts: user.canViewOtherShifts !== false,
          canViewAllSales: user.canViewAllSales !== false,
          dashboardType: user.dashboardType || (user.role === 'Cajero' ? 'CAJERO' : 'ADMIN'),
          canRegisterExpenses: user.canRegisterExpenses !== false,
          canApplyDiscountOrSurcharge: user.canApplyDiscountOrSurcharge !== false,
          canSellOnCredit: user.canSellOnCredit !== false,
          canVoidSales: user.canVoidSales !== false,
          createdAt: user.createdAt
        };
      });

      return res.status(200).json({
        success: true,
        users: sanitizedUsers
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/users
   * Creates a new user.
   */
  async createUser(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { 
        username, 
        password, 
        name, 
        role, 
        imageUrl, 
        allowedDepartments, 
        allowedFunctions, 
        canConfigurePrinters, 
        canModifyManualRate,
        cashRegister,
        canViewOtherShifts,
        canViewAllSales,
        dashboardType,
        canRegisterExpenses,
        canApplyDiscountOrSurcharge,
        canSellOnCredit,
        canVoidSales
      } = req.body;

      if (!username || !password || !name) {
        return res.status(400).json({
          success: false,
          error: 'Debe ingresar nombre de usuario, contraseña y nombre completo'
        });
      }

      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'El nombre de usuario ya está registrado'
        });
      }

      const hashedPassword = await bcryptjs.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          name,
          isAdmin: role === 'Administrador',
          role: role || 'Cajero',
          imageUrl: imageUrl || '',
          allowedDepartments: JSON.stringify(allowedDepartments || []),
          allowedFunctions: JSON.stringify(allowedFunctions || []),
          canConfigurePrinters: canConfigurePrinters !== false,
          canModifyManualRate: canModifyManualRate !== false,
          cashRegister: cashRegister || '',
          canViewOtherShifts: canViewOtherShifts !== false,
          canViewAllSales: canViewAllSales !== false,
          dashboardType: dashboardType || (role === 'Cajero' ? 'CAJERO' : 'ADMIN'),
          canRegisterExpenses: canRegisterExpenses !== false,
          canApplyDiscountOrSurcharge: canApplyDiscountOrSurcharge !== false,
          canSellOnCredit: canSellOnCredit !== false,
          canVoidSales: canVoidSales !== false
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/auth/users/:id
   * Updates an existing user.
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params;
      const { 
        name, 
        password, 
        role, 
        imageUrl, 
        allowedDepartments, 
        allowedFunctions, 
        canConfigurePrinters, 
        canModifyManualRate,
        cashRegister,
        canViewOtherShifts,
        canViewAllSales,
        dashboardType,
        canRegisterExpenses,
        canApplyDiscountOrSurcharge,
        canSellOnCredit,
        canVoidSales
      } = req.body;

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      const updateData: any = {
        name: name || existing.name,
        role: role || existing.role,
        isAdmin: role === 'Administrador',
        imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
        allowedDepartments: allowedDepartments !== undefined ? JSON.stringify(allowedDepartments) : existing.allowedDepartments,
        allowedFunctions: allowedFunctions !== undefined ? JSON.stringify(allowedFunctions) : existing.allowedFunctions,
        canConfigurePrinters: canConfigurePrinters !== undefined ? !!canConfigurePrinters : existing.canConfigurePrinters,
        canModifyManualRate: canModifyManualRate !== undefined ? !!canModifyManualRate : existing.canModifyManualRate,
        cashRegister: cashRegister !== undefined ? cashRegister : existing.cashRegister,
        canViewOtherShifts: canViewOtherShifts !== undefined ? !!canViewOtherShifts : existing.canViewOtherShifts,
        canViewAllSales: canViewAllSales !== undefined ? !!canViewAllSales : existing.canViewAllSales,
        dashboardType: dashboardType !== undefined ? dashboardType : existing.dashboardType,
        canRegisterExpenses: canRegisterExpenses !== undefined ? !!canRegisterExpenses : existing.canRegisterExpenses,
        canApplyDiscountOrSurcharge: canApplyDiscountOrSurcharge !== undefined ? !!canApplyDiscountOrSurcharge : existing.canApplyDiscountOrSurcharge,
        canSellOnCredit: canSellOnCredit !== undefined ? !!canSellOnCredit : existing.canSellOnCredit,
        canVoidSales: canVoidSales !== undefined ? !!canVoidSales : existing.canVoidSales
      };

      if (password && password.trim() !== '') {
        updateData.password = await bcryptjs.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData
      });

      return res.status(200).json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/auth/users/:id
   * Deletes a user.
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params;

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      if (existing.username === 'admin') {
        return res.status(400).json({
          success: false,
          error: 'No se puede eliminar el usuario administrador por defecto ("admin")'
        });
      }

      await prisma.user.delete({ where: { id } });

      return res.status(200).json({
        success: true,
        message: 'Usuario eliminado exitosamente'
      });
    } catch (err) {
      next(err);
    }
  }
}
