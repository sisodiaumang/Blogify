const Blog = require('../models/blog');

async function fetchFeedBlogs(query, sort, page, limit) {
    if (sort === 'trending') {
        const pipeline = [];
        if (Object.keys(query).length > 0) {
            pipeline.push({ $match: query });
        }
        
        // Hacker News Hotness / Instagram style algorithm:
        // Score = (views + (likes * 5) + 1) / (hours_since_created + 2)^1.5
        pipeline.push({
            $addFields: {
                hoursSinceCreated: {
                    $divide: [
                        { $subtract: [new Date(), "$createdAt"] },
                        1000 * 60 * 60
                    ]
                }
            }
        });
        pipeline.push({
            $addFields: {
                hotScore: {
                    $divide: [
                        { $add: [{ $ifNull: ["$views", 0] }, { $multiply: [{ $ifNull: ["$likes", 0] }, 5] }, 1] }, 
                        { $pow: [{ $add: ["$hoursSinceCreated", 2] }, 1.5] }
                    ]
                }
            }
        });
        
        pipeline.push({ $sort: { hotScore: -1, createdAt: -1 } });
        pipeline.push({ $skip: (page - 1) * limit });
        pipeline.push({ $limit: limit });
        
        const aggregated = await Blog.aggregate(pipeline);
        return await Blog.populate(aggregated, { path: 'createdBy', select: 'fullName profileImageURL' });
    } else {
        let sortOption = { createdAt: -1 };
        if (sort === 'views') sortOption = { views: -1, createdAt: -1 };
        else if (sort === 'likes') sortOption = { likes: -1, createdAt: -1 };
        
        return await Blog.find(query)
            .select('title slug coverImageURL category readTimeMinutes views likes createdAt createdBy')
            .populate('createdBy', 'fullName profileImageURL')
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
    }
}

module.exports = { fetchFeedBlogs };
