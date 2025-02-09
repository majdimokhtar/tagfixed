import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Headers
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  RetrieveAnnouncementUsecase,
  ViewAnnouncementsUsecase
} from '@wdi-website/application';
import {
  AnnouncementStatus,
  IAnnouncement
} from '@wdi-website/domain';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

// Keep the original DTO structure with single language fields
export class LocalizedDisplayAnnouncementDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  scopeOfWork: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  status: AnnouncementStatus;

  @ApiProperty()
  files: {
    id: string;
    url: string;
    filename: string;
    mimetype: string;
    size: number;
    path: string;
    createdAt: Date;
    updatedAt: Date;
  }[];

  @ApiProperty()
  authorId: string;

  @ApiProperty()
  authorEmail: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  referenceNumber: string;

  @ApiProperty()
  tags: {
    id: string;
    name: string;
    nameAr: string;
  }[];
}

export class FilterAnnouncementsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

@ApiTags('Public Announcements')
@Controller('announcements')
export class PublicAnnouncementController {
  constructor(
    private readonly viewAnnouncementsUsecase: ViewAnnouncementsUsecase,
    private readonly retrieveAnnouncementUsecase: RetrieveAnnouncementUsecase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all published announcements' })
  @ApiHeader({
    name: 'Accept-Language',
    description: 'Preferred language for response (e.g., "en" or "ar")',
    required: false,
  })
  // @ApiResponse({
  //   status: 200,
  //   description: 'List of announcements retrieved successfully.',
  //   type: [LocalizedDisplayAnnouncementDto],
  // })
  async viewAnnouncements(
    @Headers('Accept-Language') lang: string = 'en',
    @Query() filters: FilterAnnouncementsDto,
  ): Promise<{ announcements: LocalizedDisplayAnnouncementDto[]; totalCount: number }> {
    try {
      const result = await this.viewAnnouncementsUsecase.execute({
        ...filters,
        status: AnnouncementStatus.PUBLISHED
      });
      
      return {
        announcements: result.announcements.map((announcement: IAnnouncement) =>
          this.mapToLocalizedDto(announcement, lang),
        ),
        totalCount: result.totalCount,
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'An unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get published announcement by ID' })
  // @ApiHeader({
  //   name: 'Accept-Language',
  //   description: 'Preferred language for response (e.g., "en" or "ar")',
  //   required: false,
  // })
  @ApiResponse({
    status: 200,
    description: 'Returns the announcement',
    type: LocalizedDisplayAnnouncementDto,
  })
  async getAnnouncementById(
    @Param('id') id: string,
    @Headers('Accept-Language') lang: string = 'en'
  ): Promise<LocalizedDisplayAnnouncementDto> {
    try {
      const announcement = await this.retrieveAnnouncementUsecase.execute(id, 'public');
      if (!announcement || announcement.status !== AnnouncementStatus.PUBLISHED) {
        throw new BadRequestException('Announcement not found or not published');
      }

      return this.mapToLocalizedDto(announcement, lang);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'An unknown error occurred',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private mapToLocalizedDto(
    announcement: IAnnouncement,
    lang: string
  ): LocalizedDisplayAnnouncementDto {
    const localizedDto = new LocalizedDisplayAnnouncementDto();
    const now = new Date();
    
    localizedDto.id = announcement.id;
    localizedDto.title = lang === 'ar' ? announcement.title_ar : announcement.title_en;
    localizedDto.description = lang === 'ar' ? announcement.description_ar : announcement.description_en;
    localizedDto.scopeOfWork = lang === 'ar' ? announcement.scopeOfWork_ar : announcement.scopeOfWork_en;
    localizedDto.date = announcement.date || now;
    localizedDto.status = announcement.status;
    localizedDto.files = announcement.files?.map(file => ({
      id: file.id,
      url: file.url,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      createdAt: file.createdAt || now,
      updatedAt: file.updatedAt || now
    })) || [];
    localizedDto.authorId = announcement.authorId;
    localizedDto.authorEmail = announcement.authorEmail;
    localizedDto.createdAt = announcement.createdAt || now;
    localizedDto.updatedAt = announcement.updatedAt || now;
    localizedDto.referenceNumber = announcement.referenceNumber;
    localizedDto.tags = announcement.tags?.map((tag) => ({
      id: tag.id,
      name: tag.name,
      nameAr: tag.nameAr || tag.name
    })) || [];

    return localizedDto;
  }
}
