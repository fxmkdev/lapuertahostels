const statusQuery = `query($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Deployment {
      databaseId
      statuses(first: 100) {
        nodes { environmentUrl }
        pageInfo { hasNextPage }
      }
    }
  }
}`;

async function* pages(json, path, parameters, pageSize) {
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({
      ...parameters,
      per_page: String(pageSize),
      page: String(page),
    });
    const items = await json(`${path}?${query}`);
    if (!Array.isArray(items))
      throw new Error(`GitHub ${path} returned an invalid list`);
    yield items;
    if (items.length < pageSize) return;
  }
}

function validateStatusBatch(response, batch) {
  const nodes = response.data?.nodes;
  if (
    response.errors?.length ||
    !Array.isArray(nodes) ||
    nodes.length !== batch.length
  )
    throw new Error("GitHub returned an incomplete deployment status batch");
  return nodes.map((node, index) => {
    if (
      node?.databaseId !== batch[index].id ||
      !Array.isArray(node.statuses?.nodes) ||
      typeof node.statuses.pageInfo?.hasNextPage !== "boolean"
    )
      throw new Error("GitHub returned an invalid deployment status record");
    return { deployment: batch[index], statuses: node.statuses };
  });
}

async function* deploymentStatuses(json, listPages, repoPath, deployments) {
  // Fifty deployments with up to 100 statuses each fit comfortably within
  // GraphQL's node limit and cost one point for a normal batch, rather than
  // one REST request for every deployment in the repository's history.
  for (let offset = 0; offset < deployments.length; offset += 50) {
    const batch = deployments.slice(offset, offset + 50);
    if (
      batch.some(
        (deployment) =>
          !Number.isSafeInteger(deployment.id) ||
          !deployment.node_id ||
          !deployment.ref,
      )
    )
      throw new Error("Invalid deployment record");
    const response = await json("/graphql", {
      method: "POST",
      body: JSON.stringify({
        query: statusQuery,
        variables: { ids: batch.map((deployment) => deployment.node_id) },
      }),
    });
    for (const { deployment, statuses } of validateStatusBatch(
      response,
      batch,
    )) {
      yield {
        deployment,
        statuses: statuses.nodes.map((status) => ({
          environment_url: status.environmentUrl,
        })),
      };
      if (statuses.pageInfo.hasNextPage) {
        // Rare long histories use the existing REST pagination. Re-reading
        // the first page is harmless because branch associations are sets.
        for await (const page of listPages(
          `${repoPath}/deployments/${deployment.id}/statuses`,
        ))
          yield { deployment, statuses: page };
      }
    }
  }
}

export function githubClient({
  token,
  apiUrl = "https://api.github.com",
  request = fetch,
  pageSize = 100,
}) {
  const json = async (path, options = {}) => {
    if (!token) throw new Error("GITHUB_TOKEN is required for PR lookup");
    const response = await request(
      new URL(`${apiUrl.replace(/\/$/, "")}${path}`),
      {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok)
      throw new Error(
        `GitHub ${path.split("?")[0]} returned HTTP ${response.status}`,
      );
    return response.json();
  };
  const listPages = (path, parameters = {}) =>
    pages(json, path, parameters, pageSize);
  return {
    pages: listPages,
    deploymentStatuses: (repoPath, deployments) =>
      deploymentStatuses(json, listPages, repoPath, deployments),
  };
}
