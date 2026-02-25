import { Global, Module } from "@nestjs/common";
import { PermissionService } from "./permission.service.js";

@Global()
@Module({
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionsModule {}
