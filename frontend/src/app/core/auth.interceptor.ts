import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const token = auth.token();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError(error => {
      if (error.status === 401 && token && !req.url.endsWith('/auth/refresh')) {
        return auth.refreshSession().pipe(
          switchMap(() => {
            const refreshedToken = auth.token();
            const retryReq = refreshedToken ? req.clone({ setHeaders: { Authorization: `Bearer ${refreshedToken}` } }) : req;
            return next(retryReq);
          }),
          catchError(refreshError => {
            toast.show(refreshError.error?.message || '登录已过期，请重新登录');
            auth.logout();
            return throwError(() => refreshError);
          })
        );
      }
      toast.show(error.error?.message || '请求失败，请稍后重试');
      if (error.status === 401) auth.logout();
      return throwError(() => error);
    })
  );
};
