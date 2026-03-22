const getItemKey = (item) => item.componentName || item.operationName;

const buildNumericDiff = (oldValue = 0, newValue = 0) => ({
  old: oldValue,
  new: newValue,
  diff: newValue - oldValue,
});

const buildBomDiffRow = (oldItem, newItem) => {
  const name = getItemKey(newItem || oldItem);
  const isOperation = Boolean((newItem || oldItem)?.operationName);

  const oldQuantity = oldItem?.quantity || 0;
  const newQuantity = newItem?.quantity || 0;
  const oldDuration = oldItem?.expectedDuration || 0;
  const newDuration = newItem?.expectedDuration || 0;
  const oldWorkCenter = oldItem?.workCenter || '';
  const newWorkCenter = newItem?.workCenter || '';

  let change = 'unchanged';
  if (!oldItem) {
    change = 'added';
  } else if (!newItem) {
    change = 'removed';
  } else if (
    oldQuantity !== newQuantity ||
    oldDuration !== newDuration ||
    oldWorkCenter !== newWorkCenter
  ) {
    change = 'modified';
  }

  return {
    name,
    change,
    type: change,
    quantity: buildNumericDiff(oldQuantity, newQuantity),
    duration: buildNumericDiff(oldDuration, newDuration),
    workCenter: {
      old: oldWorkCenter,
      new: newWorkCenter,
    },
    workCenterChanged: oldWorkCenter !== newWorkCenter,
    units: isOperation ? 'min' : newItem?.units || oldItem?.units || 'Units',
  };
};

const generateBomDiff = (oldItems = [], newItems = []) => {
  const diff = [];
  const oldMap = new Map(oldItems.map((item) => [getItemKey(item), item]));
  const newMap = new Map(newItems.map((item) => [getItemKey(item), item]));

  for (const [name, newItem] of newMap) {
    diff.push(buildBomDiffRow(oldMap.get(name), newItem));
  }

  for (const [name, oldItem] of oldMap) {
    if (!newMap.has(name)) {
      diff.push(buildBomDiffRow(oldItem, null));
    }
  }

  return diff;
};

const normalizeAttachments = (attachments = []) =>
  (attachments || []).map((attachment) => ({
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    mimeType: attachment.mimeType || 'application/octet-stream',
    fileSize: attachment.fileSize || 0,
    version: attachment.version || 1,
    status: attachment.status || 'ACTIVE',
    description: attachment.description || null,
  }));

const generateProductDiff = (oldProduct = {}, newProduct = {}) => {
  return {
    salesPrice: buildNumericDiff(oldProduct.salesPrice || 0, newProduct.salesPrice ?? oldProduct.salesPrice ?? 0),
    costPrice: buildNumericDiff(oldProduct.costPrice || 0, newProduct.costPrice ?? oldProduct.costPrice ?? 0),
    attachments: {
      old: normalizeAttachments(oldProduct.attachments || []),
      new: normalizeAttachments(newProduct.attachments || oldProduct.attachments || []),
      changed:
        JSON.stringify(normalizeAttachments(oldProduct.attachments || [])) !==
        JSON.stringify(normalizeAttachments(newProduct.attachments || oldProduct.attachments || [])),
    },
  };
};

module.exports = {
  generateBomDiff,
  generateProductDiff,
};
