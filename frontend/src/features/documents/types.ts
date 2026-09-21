import type { DocTypeMeta, FileUploadData } from '@/types/app';

export type DocUploadModalProps = {
  docType: DocTypeMeta;
  onUpload: (typeId: string, fileData: FileUploadData) => void | Promise<void>;
  onClose: () => void;
};
