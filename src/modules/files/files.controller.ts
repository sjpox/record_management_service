import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { FtpService } from '../../common/services/ftp.service';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly ftpService: FtpService) {}

  @Get('*')
  @ApiOperation({ summary: 'Get a file from FTP storage by path' })
  async getFile(@Param() params: { '0': string }, @Res() res: Response) {
    const filePath = '/' + params['0'];

    try {
      const buffer = await this.ftpService.downloadFile(filePath);
      const mimeType = this.ftpService.getMimeType(filePath);

      res.set({
        'Content-Type': mimeType,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=31536000',
      });

      res.send(buffer);
    } catch (error) {
      throw new NotFoundException('File not found');
    }
  }
}
