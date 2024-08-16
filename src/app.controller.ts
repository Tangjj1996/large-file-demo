import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';
import fs from 'fs';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: 'files',
    }),
  )
  fileUpload(@UploadedFile() file: Express.Multer.File, @Body() body) {
    const filename = body.name;
    const chunkDir = `files/chunks_${filename}`;
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir);
    }
    fs.cpSync(file.path, `${chunkDir}/${filename}-${body.index}`);
    fs.rmSync(file.path);
  }

  /** buffer merge  */
  @Post('buffer-merge')
  fileBufferMerge(@Body() body: { name: string }) {
    const chunkDir = `files/chunks_${body.name}`;
    const files = fs.readdirSync(chunkDir).sort((a, b) => {
      const aIndex = a.slice(a.lastIndexOf('-'));
      const bIndex = b.slice(b.lastIndexOf('-'));

      return Number(bIndex) - Number(aIndex);
    });
    const outputFilePath = `files/${body.name}`;
    const buffers = [];
    files.forEach((file) => {
      const filepath = `${chunkDir}/${file}`;
      const buffer = fs.readFileSync(filepath);

      buffers.push(buffer);
    });
    const concatBuffer = Buffer.concat(buffers);
    fs.writeFileSync(outputFilePath, concatBuffer);
    fs.rmSync(chunkDir, { recursive: true });
  }

  /** stream merge */
  @Post('merge')
  fileMerge(@Body() body: { name: string }) {
    const chunkDir = `files/chunks_${body.name}`;
    const files = fs.readdirSync(chunkDir).sort((a, b) => {
      const aIndex = a.slice(a.lastIndexOf('-'));
      const bIndex = b.slice(b.lastIndexOf('-'));
      return Number(bIndex) - Number(aIndex);
    });
    let startPos = 0;
    const outputFilePath = `files/${body.name}`;
    files.forEach((file, index) => {
      const filePath = `${chunkDir}/${file}`;
      const readStream = fs.createReadStream(filePath);
      const writeStream = fs.createWriteStream(outputFilePath, {
        start: startPos,
      });
      readStream.pipe(writeStream).on('finish', () => {
        if (index === files.length - 1) {
          fs.rmSync(chunkDir, { recursive: true });
        }
      });
      startPos += fs.statSync(filePath).size;
    });
  }

  @Get('file-size')
  fileDownload(@Query('id') id: string) {
    const filePath = `file_${id}`;
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      return {
        size: stat.size,
        fileName: 'test.png',
      };
    }
  }

  @Get('file-chunk')
  fileGet(
    @Query('start', ParseIntPipe) start: number,
    @Query('end', ParseIntPipe) end: number,
    @Res() res,
  ) {
    const filePath = 'file/test.png';
    const fileStream = fs.createReadStream(filePath, {
      start,
      end,
    });

    fileStream.pipe(res);
  }
}
