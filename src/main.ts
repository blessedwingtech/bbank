import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import flash from 'connect-flash';
import helmet from 'helmet';
import csurf from 'csurf';
import expressLayouts from 'express-ejs-layouts';
import { createSessionConfig } from './config/session.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { winstonLogger } from './config/winston.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });

  // Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows CDN scripts (HTMX, Bootstrap, DataTables, SweetAlert2)
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Cookie parser
  app.use(cookieParser());

  // Session configuration
  app.use(createSessionConfig());

  // Flash messages support
  app.use(flash());

  // CSRF Protection
  const csrfProtection = csurf({ cookie: false });
  app.use((req: any, res: any, next: any) => {
    csrfProtection(req, res, (err: any) => {
      if (err) {
        if (err.code === 'EBADCSRFTOKEN') {
          if (req.flash) {
            req.flash('error', 'Session expirée ou jeton CSRF invalide. Veuillez rafraîchir la page.');
          }
          const isHtmx = req.headers['hx-request'] === 'true';
          if (isHtmx) {
            res.setHeader('HX-Refresh', 'true');
            return res.status(403).send();
          }
          return res.redirect('back');
        }
        return next(err);
      }
      next();
    });
  });

  // Views and Static Assets - Using process.cwd() for robust root resolution
  const publicDir = join(process.cwd(), 'public');
  const viewsDir = join(process.cwd(), 'views');

  app.useStaticAssets(publicDir, { prefix: '/public' });
  app.setBaseViewsDir(viewsDir);
  app.setViewEngine('ejs');
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');
  app.set('layout extractScripts', true);
  app.set('layout extractStyles', true);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);

  winstonLogger.info(`🚀 B-Bank Application démarrée avec succès sur http://localhost:${port}`);
  console.log(`🚀 B-Bank Application démarrée sur http://localhost:${port}`);
}

bootstrap();
