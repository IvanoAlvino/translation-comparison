import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'exercise',
    loadComponent: () => import('./pages/exercise/exercise').then((m) => m.Exercise),
  },
  {
    path: 'results',
    loadComponent: () => import('./pages/results/results').then((m) => m.Results),
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
  },
  { path: '**', redirectTo: '' },
];
