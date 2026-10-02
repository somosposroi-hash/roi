import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nubly_pos_access_super_secret_key_99';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    name: string;
    isAdmin: boolean;
  };
}

export function authenticateAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No autorizado: Token de acceso no proporcionado o inválido',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      name: string;
      isAdmin: boolean;
    };
    
    if (!decoded.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Prohibido: Se requieren privilegios de administrador',
      });
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'No autorizado: Token de acceso expirado o inválido',
    });
  }
}
