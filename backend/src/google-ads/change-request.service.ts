import { Injectable } from '@nestjs/common';
import { AiPersistenceService } from './ai-persistence.service';

@Injectable()
export class ChangeRequestService {
  constructor(private readonly aiPersistence: AiPersistenceService) {}

  createTextChangeRequest(
    ...args: Parameters<AiPersistenceService['createTextChangeRequest']>
  ) {
    return this.aiPersistence.createTextChangeRequest(...args);
  }

  getChangeRequestPreview(
    ...args: Parameters<AiPersistenceService['getChangeRequestPreview']>
  ) {
    return this.aiPersistence.getChangeRequestPreview(...args);
  }

  getTextChangeRequestForApply(
    ...args: Parameters<AiPersistenceService['getTextChangeRequestForApply']>
  ) {
    return this.aiPersistence.getTextChangeRequestForApply(...args);
  }

  completeTextChangeRequest(
    ...args: Parameters<AiPersistenceService['completeTextChangeRequest']>
  ) {
    return this.aiPersistence.completeTextChangeRequest(...args);
  }

  failChangeRequest(
    ...args: Parameters<AiPersistenceService['failChangeRequest']>
  ) {
    return this.aiPersistence.failChangeRequest(...args);
  }
}
