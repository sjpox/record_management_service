import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { UsersModule } from './modules/users/users.module';
import { FilesModule } from './modules/files/files.module';
import { AuthModule } from './modules/auth/auth.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { IndexDocumentModule } from './modules/index-document/index-document.module';
import { OtherDocumentModule } from './modules/other-document/other-document.module';
import { ShelfMapModule } from './modules/shelf-map/shelf-map.module';
import { LocationModule } from './modules/location/location.module';
import { CommsModule } from './modules/comms/comms.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RecipientGroupsModule } from './modules/recipient-groups/recipient-groups.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { VoucherAgeingModule } from './modules/voucher-ageing/voucher-ageing.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { MaintenanceMiddleware } from './modules/health/maintenance.middleware';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    AuditModule,
    HealthModule,
    AuthModule,
    VouchersModule,
    UsersModule,
    FilesModule,
    ReportsModule,
    IndexDocumentModule,
    OtherDocumentModule,
    LocationModule,
    ShelfMapModule,
    NotificationsModule,
    CommsModule,
    ChatModule,
    RecipientGroupsModule,
    AnnouncementsModule,
    VoucherAgeingModule,
    PermissionsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MaintenanceMiddleware)
      .exclude('health/(.*)', 'health', 'auth/login', 'auth/refresh')
      .forRoutes('*');
  }
}
