import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from '../models/domain';

export function authGuard(roles?: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) {
      router.navigateByUrl('/login');
      return false;
    }
    if (roles?.length && !roles.includes(auth.role()!)) {
      router.navigateByUrl('/shop');
      return false;
    }
    return true;
  };
}

