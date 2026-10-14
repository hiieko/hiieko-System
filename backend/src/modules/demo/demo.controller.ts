import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DemoService, DemoAccount } from './demo.service';

@ApiTags('Demo')
@Controller('api/demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'List demo accounts that have data (public)' })
  getAccounts(): Promise<DemoAccount[]> {
    return this.demoService.getAccounts();
  }
}
