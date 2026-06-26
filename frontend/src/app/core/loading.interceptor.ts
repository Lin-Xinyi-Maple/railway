import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { LoadingService } from './loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  const url = new URL(req.url, window.location.origin);
  const currentPath = window.location.pathname;
  const isBackground =
    (req.method === 'GET' && url.pathname.endsWith('/messages')) ||
    (req.method === 'GET' && url.pathname.endsWith('/messages/unread-count')) ||
    (req.method === 'POST' && url.pathname.endsWith('/messages/read')) ||
    (req.method === 'GET' && url.pathname.endsWith('/friends')) ||
    (req.method === 'GET' && url.pathname.endsWith('/products') && (currentPath === '/' || currentPath.startsWith('/home')));
  if (isBackground) return next(req);

  loading.show();
  return next(req).pipe(finalize(() => loading.hide()));
};
