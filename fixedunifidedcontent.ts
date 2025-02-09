import { Inject, Injectable } from '@nestjs/common';
import {
  ANNOUNCEMENT_REPOSITORY,
  AnnouncementRepository,
  ARTICLE_REPOSITORY,
  ArticleRepository,
  ArticleStatus,
  CATEGORY_REPOSITORY,
  CategoryRepository,
  EXCHANGE_RATE_REPOSITORY,
  ExchangeRateRepository,
  IAnnouncement,
  IArticle,
  ICategory,
  IExchangeRate,
  ITag,
  ITender,
  TAG_REPOSITORY,
  TagRepository,
  TENDER_REPOSITORY,
  TenderRepository,
} from '@wdi-website/domain';

export interface QueryMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UnifiedContentResult {
  metadata: Record<string, PaginationMetadata>;
  articles?: IArticle[];
  categories?: ICategory[];
  tags?: ITag[];
  tenders?: ITender[];
  announcements?: IAnnouncement[];
  exchangeRates?: IExchangeRate[];
  articleTags?: ITag[];
  tenderTags?: ITag[];
  announcementTags?: ITag[];
}

export interface UnifiedContentOptions {
  include: Array<keyof UnifiedContentResult>;
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class UnifiedContentQuery {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly articleRepository: ArticleRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepository,
    @Inject(TAG_REPOSITORY)
    private readonly tagRepository: TagRepository,
    @Inject(TENDER_REPOSITORY)
    private readonly tenderRepository: TenderRepository,
    @Inject(ANNOUNCEMENT_REPOSITORY)
    private readonly announcementRepository: AnnouncementRepository,
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: ExchangeRateRepository,
  ) {}

  async execute(
    options: UnifiedContentOptions,
  ): Promise<UnifiedContentResult> {
    const { include } = options;
    const results = await Promise.all(
      include.map((key) => {
        switch (key) {
          case 'articles':
            return this.getArticles();
          case 'categories':
            return this.getCategories();
          case 'tags':
            return this.getTags();
          case 'tenders':
            return this.getTenders();
          case 'announcements':
            return this.getAnnouncements();
          case 'exchangeRates':
            return this.getExchangeRates();
          case 'articleTags':
            return this.getArticleTags();
          case 'tenderTags':
            return this.getTenderTags();
          case 'announcementTags':
            return this.getAnnouncementTags();
          default:
            return Promise.resolve(null);
        }
      }),
    );

    type QueryResult = { items: unknown[] } & QueryMetadata | null;
    type ContentKey = Exclude<keyof UnifiedContentResult, 'metadata'>;

    const metadata = results.reduce((acc: Record<string, PaginationMetadata>, curr: QueryResult, index: number) => {
      if (curr) {
        acc[include[index]] = this.createMetadata(curr);
      }
      return acc;
    }, {} as Record<string, PaginationMetadata>);

    const items = results.reduce((acc: Partial<UnifiedContentResult>, curr: QueryResult, index: number) => {
      if (curr) {
        const key = include[index] as ContentKey;
        switch (key) {
          case 'articles':
            acc.articles = curr.items as IArticle[];
            break;
          case 'categories':
            acc.categories = curr.items as ICategory[];
            break;
          case 'tags':
            acc.tags = curr.items as ITag[];
            break;
          case 'tenders':
            acc.tenders = curr.items as ITender[];
            break;
          case 'announcements':
            acc.announcements = curr.items as IAnnouncement[];
            break;
          case 'exchangeRates':
            acc.exchangeRates = curr.items as IExchangeRate[];
            break;
          case 'articleTags':
            acc.articleTags = curr.items as ITag[];
            break;
          case 'tenderTags':
            acc.tenderTags = curr.items as ITag[];
            break;
          case 'announcementTags':
            acc.announcementTags = curr.items as ITag[];
            break;
        }
      }
      return acc;
    }, {});

    return {
      metadata,
      ...items,
    };
  }

  private createMetadata(result: QueryMetadata): PaginationMetadata {
    return {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  private async getArticles(): Promise<{
    items: IArticle[];
  } & QueryMetadata> {
    const result = await this.articleRepository.list({
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      status: ArticleStatus.PUBLISHED 
    });
    return {
      items: result.articles,
      total: result.totalResults,
      page: result.currentPage,
      limit: 10,
      totalPages: result.totalPages,
    };
  }

  private async getCategories(): Promise<{
    items: ICategory[];
  } & QueryMetadata> {
    const categories = await this.categoryRepository.list();
    return {
      items: categories,
      total: categories.length,
      page: 1,
      limit: categories.length,
      totalPages: 1,
    };
  }

  private async getTags(): Promise<{
    items: ITag[];
  } & QueryMetadata> {
    const result = await this.tagRepository.listAll();
    return {
      items: result.tags,
      total: result.total,
      page: 1,
      limit: result.total,
      totalPages: 1,
    };
  }

  private async getArticleTags(): Promise<{
    items: ITag[];
  } & QueryMetadata> {
    const result = await this.tagRepository.listArticleTags();
    return {
      items: result.tags,
      total: result.total,
      page: 1,
      limit: result.total,
      totalPages: 1,
    };
  }

  private async getTenderTags(): Promise<{
    items: ITag[];
  } & QueryMetadata> {
    const result = await this.tagRepository.listTenderTags();
    return {
      items: result.tags,
      total: result.total,
      page: 1,
      limit: result.total,
      totalPages: 1,
    };
  }

  private async getAnnouncementTags(): Promise<{
    items: ITag[];
  } & QueryMetadata> {
    const result = await this.tagRepository.listAnnouncementTags();
    return {
      items: result.tags,
      total: result.total,
      page: 1,
      limit: result.total,
      totalPages: 1,
    };
  }

  private async getTenders(): Promise<{
    items: ITender[];
  } & QueryMetadata> {
    const tenders = await this.tenderRepository.listPublishedTenders();
    return {
      items: tenders,
      total: tenders.length,
      page: 1,
      limit: tenders.length,
      totalPages: 1,
    };
  }

  private async getAnnouncements(): Promise<{
    items: IAnnouncement[];
  } & QueryMetadata> {
    const announcements = await this.announcementRepository.listPublishedAnnouncements();
    return {
      items: announcements,
      total: announcements.length,
      page: 1,
      limit: announcements.length,
      totalPages: 1,
    };
  }

  private async getExchangeRates(): Promise<{
    items: IExchangeRate[];
  } & QueryMetadata> {
    const exchangeRates = await this.exchangeRateRepository.listExchangeRates();
    return {
      items: exchangeRates,
      total: exchangeRates.length,
      page: 1,
      limit: exchangeRates.length,
      totalPages: 1,
    };
  }

  async getContentByTag(queryConfig: {
    tagId: string;
    type: 'articles' | 'tenders' | 'announcements';
  }): Promise<Array<IArticle | ITender | IAnnouncement>> {
    const { tagId, type } = queryConfig;
    let articleResult;
    let tenderResult;
    let announcementResult;

    switch (type) {
      case 'articles':
        articleResult = await this.articleRepository.list({
          page: 1,
          pageSize: 100,
          tagId
        });
        return articleResult.articles;
      case 'tenders':
        tenderResult = await this.tenderRepository.fetchTendersWithFilters({
          filters: {
            status: 'published',
          },
        });
        return tenderResult.filter(tender => 
          tender.tags.some(tag => tag.id === tagId)
        );
      case 'announcements':
        announcementResult = await this.announcementRepository.fetchAnnouncementsWithFilters({
          filters: {
            status: 'published',
          },
        });
        return announcementResult.filter(announcement => 
          announcement.tags.some(tag => tag.id === tagId)
        );
      default:
        throw new Error('Invalid content type');
    }
  }
}
