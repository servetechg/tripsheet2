import { existsSync, readFileSync } from 'fs';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { App } from 'firebase-admin/app';
import {
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { resolveFirebaseCredentialsPath, secretsDirectoryHint } from './firebase-credentials.util';

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private messagingClient: Messaging | null = null;
  private initHint = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (getApps().length > 0) {
      this.messagingClient = getMessaging();
      return;
    }

    const projectId =
      this.config.get<string>('FIREBASE_PROJECT_ID') || undefined;
    const jsonRaw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    const credPath = this.config.get<string>('GOOGLE_APPLICATION_CREDENTIALS');

    try {
      let parsed: ServiceAccountJson | null = null;

      if (jsonRaw?.trim()) {
        parsed = JSON.parse(jsonRaw) as ServiceAccountJson;
      } else {
        const serviceRoot = process.cwd();
        const { path: resolvedPath } = resolveFirebaseCredentialsPath(
          credPath,
          serviceRoot,
        );
        if (!existsSync(resolvedPath)) {
          const dirHint = secretsDirectoryHint(serviceRoot);
          this.initHint = dirHint
            ? `${dirHint} (expected: ${resolvedPath})`
            : `Service account JSON not found at ${resolvedPath}. See backend/secrets/SETUP.txt`;
          this.logger.error(this.initHint);
          return;
        }
        parsed = JSON.parse(
          readFileSync(resolvedPath, 'utf8'),
        ) as ServiceAccountJson;
      }

      if (!parsed?.client_email || !parsed?.private_key) {
        this.initHint = 'Service account JSON is missing client_email or private_key';
        this.logger.error(this.initHint);
        return;
      }

      const app: App = initializeApp({
        credential: cert({
          projectId: parsed.project_id || projectId,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        }),
        projectId: projectId || parsed.project_id,
      });

      this.messagingClient = getMessaging(app);
      this.initHint = '';
      this.logger.log('Firebase Admin initialized for FCM');
    } catch (e) {
      this.initHint = String(e);
      this.logger.error(`Firebase Admin init failed: ${this.initHint}`);
      this.messagingClient = null;
    }
  }

  isConfigured(): boolean {
    return this.messagingClient !== null;
  }

  getInitHint(): string {
    return this.initHint;
  }

  messaging(): Messaging {
    if (!this.messagingClient) {
      const extra = this.initHint ? ` ${this.initHint}` : '';
      throw new ServiceUnavailableException(
        `Firebase Cloud Messaging is not configured on notification-service.${extra}`,
      );
    }
    return this.messagingClient;
  }
}
