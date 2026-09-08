/**
 * Types the backend's OpenAPI contract doesn't define: not persisted API
 * shapes, but constants/state shapes this frontend owns. See domain.ts
 * for everything derived from api.d.ts.
 */
import type { UserPublic } from './domain';

// id_rol values — see backend/CLAUDE.md "Roles". Not part of the OpenAPI
// contract (id_rol is typed as a plain number there), so declared here.
export const Rol = {
  CIUDADANO: 1,
  ENTIDAD: 2,
  MODERADOR: 3,
  ADMINISTRADOR: 4,
} as const;

export type Rol = (typeof Rol)[keyof typeof Rol];

export interface AuthContextValue {
  user: UserPublic | null;
  token: string | null;
  loading: boolean;
  login: (correo: string, password: string) => Promise<UserPublic>;
  logout: () => Promise<void>;
  updateUser: (userData: UserPublic) => void;
  isAdmin: boolean;
  isModerador: boolean;
  isEntidad: boolean;
  isCiudadano: boolean;
}
