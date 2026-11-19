import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { winstonLogger } from '../../config/winston.config';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Une erreur interne est survenue sur le serveur.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = (res as any).message || JSON.stringify(res);
        if (Array.isArray(message)) {
          message = message.join(', ');
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    winstonLogger.error(`[${request.method}] ${request.url} - Status ${status} - Error: ${message}`, {
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    if (response.headersSent) {
      return;
    }

    // Don't render full EJS views for background static files or browser service workers that 404
    if (request.url.includes('.') && status === HttpStatus.NOT_FOUND) {
      return response.status(404).send('Not Found');
    }

    // Check if HTMX request
    const isHtmx = request.headers['hx-request'] === 'true';

    // If Unauthorized on web request, redirect to /auth/login
    if (status === HttpStatus.UNAUTHORIZED) {
      if (isHtmx) {
        response.setHeader('HX-Redirect', '/auth/login');
        return response.status(status).send();
      }
      return response.redirect('/auth/login');
    }

    // Determine error template
    let viewName = 'errors/500';
    if (status === HttpStatus.FORBIDDEN) {
      viewName = 'errors/403';
    } else if (status === HttpStatus.NOT_FOUND) {
      viewName = 'errors/404';
    }

    const csrfToken = typeof request.csrfToken === 'function' ? request.csrfToken() : '';
    const user = request.session?.user || null;

    try {
      return response.status(status).render(viewName, {
        statusCode: status,
        message,
        isHtmx,
        user,
        connected: !!user,
        csrfToken,
        pageTitle: `Erreur ${status}`,
      });
    } catch (renderError) {
      return response.status(status).send(`Erreur ${status}: ${message}`);
    }
  }
}
