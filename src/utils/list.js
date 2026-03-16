const { z } = require("zod");

const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");
const queryBooleanSchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

function createListQuerySchema({ sortBy, defaultSortBy, filters = {} }) {
  return z.object({
    ...filters,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.enum(sortBy).default(defaultSortBy),
    sortOrder: sortOrderSchema,
  });
}

function buildListMeta({
  page,
  limit,
  total,
  sortBy,
  sortOrder,
  filters = {},
}) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    sortBy,
    sortOrder,
    filters,
  };
}

function getPaginationParams(page, limit) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

function pickDefinedFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  );
}

module.exports = {
  sortOrderSchema,
  queryBooleanSchema,
  createListQuerySchema,
  buildListMeta,
  getPaginationParams,
  pickDefinedFilters,
};
