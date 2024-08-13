import { ConfigurableModuleBuilder } from '@nestjs/common';
import { CloudinaryModuleOptions } from './interfaces';
/**
 *
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<CloudinaryModuleOptions>({
    moduleName: 'CloudinaryModule',
  })
    .setExtras(
      {
        isGlobal: true,
      },
      (definition, extras) => ({
        ...definition,
        global: extras.isGlobal,
      }),
    )
    .setClassMethodName('forRoot')
    .build();
