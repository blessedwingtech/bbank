import { Global, Module } from '@nestjs/common';
import { SystemSettingService } from './system-setting.service';
import { SystemSettingController } from './system-setting.controller';

@Global()
@Module({
  controllers: [SystemSettingController],
  providers: [SystemSettingService],
  exports: [SystemSettingService],
})
export class SystemSettingModule {}
