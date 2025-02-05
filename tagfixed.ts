  async create(
    @Body() dto: CreateArticleDto,
    @UploadedFiles()
    files: {
      featuredMedia?: Express.Multer.File[];
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
    } = { featuredMedia: [], images: [], videos: [] },
    @AuthenticatedUser() user: User
  ): Promise<DisplayArticleDto> {
    try {
      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }
      if (
        ![UserRole.AUTHOR, UserRole.ADMIN, UserRole.EDITOR].includes(user.role)
      ) {
        throw new ForbiddenException(
          "You are not authorized to perform this action."
        );
      }
      // Validate file fields
      if (files?.images && typeof files.images === "string") {
        throw new BadRequestException(
          "Images must be file uploads, not strings"
        );
      }
      if (files?.videos && typeof files.videos === "string") {
        throw new BadRequestException(
          "Videos must be file uploads, not strings"
        );
      }
      if (files?.featuredMedia && typeof files.featuredMedia === "string") {
        throw new BadRequestException(
          "Featured media must be a file upload, not a string"
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsedTags: any[] = [];
      let parsedTagIds: string[] = [];

      if (dto.tags) {
        try {
          let parsed;
          // Try to parse as array first
          try {
            parsed = JSON.parse(dto.tags);
          } catch {
            // If parsing as array fails, try wrapping in array and parsing
            parsed = JSON.parse(`[${dto.tags}]`);
          }

          // Ensure we always have an array
          parsedTags = Array.isArray(parsed) ? parsed : [parsed];

          // Validate tag structure
          parsedTags.forEach((tagData) => {
            if (!tagData.name) {
              throw new BadRequestException("Each tag must have a name");
            }
          });
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new BadRequestException("Invalid JSON format for tags");
          }
          throw error;
        }
      }

      // Handle tagIds
      if (dto.tagIds) {
        // If it's already an array, use it directly
        if (Array.isArray(dto.tagIds)) {
          parsedTagIds = dto.tagIds;
        }
        // If it's a comma-separated string, split it into an array
        else if (typeof dto.tagIds === "string") {
          parsedTagIds = dto.tagIds.split(",").map((id) => id.trim());
        }
      }

      // Create initial command (without tags)
      const command: CreateArticleCommand = {
        title: dto.title,
        titleAr: dto.titleAr,
        content: dto.content,
        contentAr: dto.contentAr,
        summary: dto.summary,
        summaryAr: dto.summaryAr,
        authorId: user.id,
        authorEmail: user.email.toString(),
        categoryId: dto.categoryId,
        status: dto.status ?? ArticleStatus.DRAFT,
        images: [],
        videos: [],
        featuredMedia: undefined,
        featuredMediaId: undefined,
        tags: [], // Start with empty tags
      };

      // Create article first
      const article = await this.createArticleUsecase.execute(command, user);

      try {
        const allTags: ITag[] = [];

        // Fetch existing tags
        if (parsedTagIds.length > 0) {
          const existingTags = await Promise.all(
            parsedTagIds.map(async (tagId) => {
              const tag = await this.tagRepository.findById(tagId);
              if (!tag) {
                throw new BadRequestException(`Tag with ID ${tagId} not found`);
              }
              return tag;
            })
          );
          allTags.push(...existingTags);
        }

        // Create new tags and wait for them to be created first
        if (parsedTags.length > 0) {
          const newTags = await Promise.all(
            parsedTags.map(async (tagData) => {
              const now = new Date();
              const tagId = crypto.randomUUID();
              const tag: ITag = {
                id: tagId,
                name: tagData.name,
                nameAr: tagData.nameAr,
                createdAt: now,
                updatedAt: now,
              };
              // Wait for the tag to be created and get the result
              const createdTag = await this.tagRepository.create(tag);
              return createdTag; // Use the returned tag instead of the input tag
            })
          );
          allTags.push(...newTags);
        }

        // Ensure all tags exist before updating the article
        const validatedTags = await Promise.all(
          allTags.map(async (tag) => {
            // Double-check each tag exists in the database
            const existingTag = await this.tagRepository.findById(tag.id);
            if (!existingTag) {
              throw new BadRequestException(`Tag with ID ${tag.id} not found`);
            }
            return existingTag;
          })
        );

        // Update article with validated tags
        if (validatedTags.length > 0) {
          await this.updateArticleUsecase.execute({
            id: article.id,
            tags: validatedTags,
          });
        }

        // Handle featured media if provided and valid
        if (
          Array.isArray(files?.featuredMedia) &&
          files.featuredMedia[0]?.buffer
        ) {
          const uploadedFeaturedMedia = await this.fileUploader.uploadFile(
            files.featuredMedia[0].buffer,
            files.featuredMedia[0].originalname,
            files.featuredMedia[0].mimetype
          );
          const now = new Date();
          const featuredMedia = {
            id: uploadedFeaturedMedia.id,
            url: uploadedFeaturedMedia.url,
            filename: files.featuredMedia[0].originalname,
            mimetype: files.featuredMedia[0].mimetype,
            size: files.featuredMedia[0].size,
            path: uploadedFeaturedMedia.path ?? "",
            createdAt: now,
            updatedAt: now,
          };

          // Update article with featured media
          await this.updateArticleUsecase.execute({
            id: article.id,
            featuredMedia,
            featuredMediaId: uploadedFeaturedMedia.id,
          });
        }

        // Handle image uploads if provided and valid
        const uploadedImages: IFile[] = [];
        if (Array.isArray(files?.images)) {
          for (const file of files.images) {
            if (!file?.buffer) continue;
            const uploadedFile = await this.fileUploader.uploadFile(
              file.buffer,
              file.originalname,
              file.mimetype
            );
            const now = new Date();
            uploadedImages.push({
              id: uploadedFile.id,
              url: uploadedFile.url,
              filename: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              path: uploadedFile.path ?? "",
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // Handle video uploads if provided and valid
        const uploadedVideos: IFile[] = [];
        if (Array.isArray(files?.videos)) {
          for (const file of files.videos) {
            if (!file?.buffer) continue;
            const uploadedFile = await this.fileUploader.uploadFile(
              file.buffer,
              file.originalname,
              file.mimetype
            );
            const now = new Date();
            uploadedVideos.push({
              id: uploadedFile.id,
              url: uploadedFile.url,
              filename: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              path: uploadedFile.path ?? "",
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // Update article with images and videos if any were uploaded
        if (uploadedImages.length > 0 || uploadedVideos.length > 0) {
          await this.updateArticleUsecase.execute({
            id: article.id,
            images: uploadedImages,
            videos: uploadedVideos,
          });
        }

        // Return the final article state
        const updatedArticle = await this.getArticleByIdQuery.execute(
          article.id
        );
        return this.mapToDisplayDto(updatedArticle);
      } catch (uploadError) {
        // If file uploads fail, delete the article and throw error
        await this.deleteArticleUsecase.execute({ id: article.id });
        console.error("File upload error:", uploadError);
        throw new BadRequestException(
          `Failed to upload files: ${uploadError instanceof Error ? uploadError.message : "Unknown error"
          }`
        );
      }
    } catch (error) {
      console.error("Article creation error:", error);
      const err = error as Error;
      if (err.message?.includes('Unique constraint failed on the fields: (`articleId`,`tagId`)')) {
        throw new BadRequestException('Duplicate tags detected. Please ensure each tag is only added once.');
      }
      throw new BadRequestException(
        `Failed to create article: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
