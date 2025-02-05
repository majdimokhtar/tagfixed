  async create(tag: ITag): Promise<ITag> {
    try {
      const existingTag = await this.prisma.tag.findFirst({
        where: {
          OR: [{ name: tag.name }, { nameAr: tag.nameAr }],
        },
      });

      // If tag exists, return it instead of throwing error
      if (existingTag) {
        return this.mapToITag(existingTag);
      }

      // If tag doesn't exist, create new one
      const createdTag = await this.prisma.tag.create({
        data: {
          id: tag.id,
          name: tag.name,
          nameAr: tag.nameAr,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return this.mapToITag(createdTag);
    } catch (error) {
      console.error("Error creating tag:", error);
      throw new Error("Failed to create tag");
    }
  }
