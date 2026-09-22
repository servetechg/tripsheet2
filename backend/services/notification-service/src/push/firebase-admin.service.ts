import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import type { App } from 'firebase-admin/app';
import {
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import {
  loadServiceAccountFromConfig,
  secretsDirectoryHint,
} from './firebase-credentials.util';

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
    const serviceRoot = process.cwd();

    try {
      const loaded = loadServiceAccountFromConfig({
        jsonB64: this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON_B64'),
        jsonRaw: this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON'),
        credentialsPath: this.config.get<string>(
          'GOOGLE_APPLICATION_CREDENTIALS',
        ),
        serviceRoot,
        readFile: (path) => readFileSync(path, 'utf8'),
      });

      if (!loaded) {
        const dirHint = secretsDirectoryHint(serviceRoot);
        this.initHint =
          dirHint ||
          'Set FIREBASE_SERVICE_ACCOUNT_JSON_B64 (production) or backend/secrets/firebase-admin.json (local). See backend/secrets/SETUP.txt';
        this.logger.error(this.initHint);
        return;
      }

      const parsed = loaded.account;
      if (!parsed?.client_email || !parsed?.private_key) {
        this.initHint = `${loaded.source}: missing client_email or private_key`;
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
      this.logger.log(
        `Firebase Admin initialized for FCM (credentials from ${loaded.source})`,
      );
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
