// ipc is used for inter-process communication (essentially between the
// socket server (liwords-socket) and the main api server (liwords)

// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.26.0
// 	protoc        v3.15.8
// source: api/proto/realtime/ipc.proto

package realtime

import (
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

type RegisterRealmRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Path   string `protobuf:"bytes,1,opt,name=path,proto3" json:"path,omitempty"`
	UserId string `protobuf:"bytes,2,opt,name=user_id,json=userId,proto3" json:"user_id,omitempty"`
}

func (x *RegisterRealmRequest) Reset() {
	*x = RegisterRealmRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_proto_realtime_ipc_proto_msgTypes[0]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *RegisterRealmRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*RegisterRealmRequest) ProtoMessage() {}

func (x *RegisterRealmRequest) ProtoReflect() protoreflect.Message {
	mi := &file_api_proto_realtime_ipc_proto_msgTypes[0]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use RegisterRealmRequest.ProtoReflect.Descriptor instead.
func (*RegisterRealmRequest) Descriptor() ([]byte, []int) {
	return file_api_proto_realtime_ipc_proto_rawDescGZIP(), []int{0}
}

func (x *RegisterRealmRequest) GetPath() string {
	if x != nil {
		return x.Path
	}
	return ""
}

func (x *RegisterRealmRequest) GetUserId() string {
	if x != nil {
		return x.UserId
	}
	return ""
}

type RegisterRealmResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	// realm should be made obsolete. RegisterRealmResponse should always
	// return a list of realms.
	Realms []string `protobuf:"bytes,2,rep,name=realms,proto3" json:"realms,omitempty"`
}

func (x *RegisterRealmResponse) Reset() {
	*x = RegisterRealmResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_proto_realtime_ipc_proto_msgTypes[1]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *RegisterRealmResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*RegisterRealmResponse) ProtoMessage() {}

func (x *RegisterRealmResponse) ProtoReflect() protoreflect.Message {
	mi := &file_api_proto_realtime_ipc_proto_msgTypes[1]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use RegisterRealmResponse.ProtoReflect.Descriptor instead.
func (*RegisterRealmResponse) Descriptor() ([]byte, []int) {
	return file_api_proto_realtime_ipc_proto_rawDescGZIP(), []int{1}
}

func (x *RegisterRealmResponse) GetRealms() []string {
	if x != nil {
		return x.Realms
	}
	return nil
}

// InitRealmInfo is a request for the API server to send back information
// about that realm back to the user. For example, for the lobby realm,
// we would like lists of active games, chats, etc; for game realms, we would
// like the game history.
type InitRealmInfo struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	UserId string   `protobuf:"bytes,2,opt,name=user_id,json=userId,proto3" json:"user_id,omitempty"`
	Realms []string `protobuf:"bytes,3,rep,name=realms,proto3" json:"realms,omitempty"`
}

func (x *InitRealmInfo) Reset() {
	*x = InitRealmInfo{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_proto_realtime_ipc_proto_msgTypes[2]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *InitRealmInfo) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*InitRealmInfo) ProtoMessage() {}

func (x *InitRealmInfo) ProtoReflect() protoreflect.Message {
	mi := &file_api_proto_realtime_ipc_proto_msgTypes[2]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use InitRealmInfo.ProtoReflect.Descriptor instead.
func (*InitRealmInfo) Descriptor() ([]byte, []int) {
	return file_api_proto_realtime_ipc_proto_rawDescGZIP(), []int{2}
}

func (x *InitRealmInfo) GetUserId() string {
	if x != nil {
		return x.UserId
	}
	return ""
}

func (x *InitRealmInfo) GetRealms() []string {
	if x != nil {
		return x.Realms
	}
	return nil
}

var File_api_proto_realtime_ipc_proto protoreflect.FileDescriptor

var file_api_proto_realtime_ipc_proto_rawDesc = []byte{
	0x0a, 0x1c, 0x61, 0x70, 0x69, 0x2f, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x2f, 0x72, 0x65, 0x61, 0x6c,
	0x74, 0x69, 0x6d, 0x65, 0x2f, 0x69, 0x70, 0x63, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x12, 0x07,
	0x6c, 0x69, 0x77, 0x6f, 0x72, 0x64, 0x73, 0x22, 0x43, 0x0a, 0x14, 0x52, 0x65, 0x67, 0x69, 0x73,
	0x74, 0x65, 0x72, 0x52, 0x65, 0x61, 0x6c, 0x6d, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12,
	0x12, 0x0a, 0x04, 0x70, 0x61, 0x74, 0x68, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x04, 0x70,
	0x61, 0x74, 0x68, 0x12, 0x17, 0x0a, 0x07, 0x75, 0x73, 0x65, 0x72, 0x5f, 0x69, 0x64, 0x18, 0x02,
	0x20, 0x01, 0x28, 0x09, 0x52, 0x06, 0x75, 0x73, 0x65, 0x72, 0x49, 0x64, 0x22, 0x2f, 0x0a, 0x15,
	0x52, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x52, 0x65, 0x61, 0x6c, 0x6d, 0x52, 0x65, 0x73,
	0x70, 0x6f, 0x6e, 0x73, 0x65, 0x12, 0x16, 0x0a, 0x06, 0x72, 0x65, 0x61, 0x6c, 0x6d, 0x73, 0x18,
	0x02, 0x20, 0x03, 0x28, 0x09, 0x52, 0x06, 0x72, 0x65, 0x61, 0x6c, 0x6d, 0x73, 0x22, 0x40, 0x0a,
	0x0d, 0x49, 0x6e, 0x69, 0x74, 0x52, 0x65, 0x61, 0x6c, 0x6d, 0x49, 0x6e, 0x66, 0x6f, 0x12, 0x17,
	0x0a, 0x07, 0x75, 0x73, 0x65, 0x72, 0x5f, 0x69, 0x64, 0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52,
	0x06, 0x75, 0x73, 0x65, 0x72, 0x49, 0x64, 0x12, 0x16, 0x0a, 0x06, 0x72, 0x65, 0x61, 0x6c, 0x6d,
	0x73, 0x18, 0x03, 0x20, 0x03, 0x28, 0x09, 0x52, 0x06, 0x72, 0x65, 0x61, 0x6c, 0x6d, 0x73, 0x42,
	0x34, 0x5a, 0x32, 0x67, 0x69, 0x74, 0x68, 0x75, 0x62, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x64, 0x6f,
	0x6d, 0x69, 0x6e, 0x6f, 0x31, 0x34, 0x2f, 0x6c, 0x69, 0x77, 0x6f, 0x72, 0x64, 0x73, 0x2f, 0x72,
	0x70, 0x63, 0x2f, 0x61, 0x70, 0x69, 0x2f, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x2f, 0x72, 0x65, 0x61,
	0x6c, 0x74, 0x69, 0x6d, 0x65, 0x62, 0x06, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x33,
}

var (
	file_api_proto_realtime_ipc_proto_rawDescOnce sync.Once
	file_api_proto_realtime_ipc_proto_rawDescData = file_api_proto_realtime_ipc_proto_rawDesc
)

func file_api_proto_realtime_ipc_proto_rawDescGZIP() []byte {
	file_api_proto_realtime_ipc_proto_rawDescOnce.Do(func() {
		file_api_proto_realtime_ipc_proto_rawDescData = protoimpl.X.CompressGZIP(file_api_proto_realtime_ipc_proto_rawDescData)
	})
	return file_api_proto_realtime_ipc_proto_rawDescData
}

var file_api_proto_realtime_ipc_proto_msgTypes = make([]protoimpl.MessageInfo, 3)
var file_api_proto_realtime_ipc_proto_goTypes = []interface{}{
	(*RegisterRealmRequest)(nil),  // 0: liwords.RegisterRealmRequest
	(*RegisterRealmResponse)(nil), // 1: liwords.RegisterRealmResponse
	(*InitRealmInfo)(nil),         // 2: liwords.InitRealmInfo
}
var file_api_proto_realtime_ipc_proto_depIdxs = []int32{
	0, // [0:0] is the sub-list for method output_type
	0, // [0:0] is the sub-list for method input_type
	0, // [0:0] is the sub-list for extension type_name
	0, // [0:0] is the sub-list for extension extendee
	0, // [0:0] is the sub-list for field type_name
}

func init() { file_api_proto_realtime_ipc_proto_init() }
func file_api_proto_realtime_ipc_proto_init() {
	if File_api_proto_realtime_ipc_proto != nil {
		return
	}
	if !protoimpl.UnsafeEnabled {
		file_api_proto_realtime_ipc_proto_msgTypes[0].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*RegisterRealmRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_api_proto_realtime_ipc_proto_msgTypes[1].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*RegisterRealmResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_api_proto_realtime_ipc_proto_msgTypes[2].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*InitRealmInfo); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_api_proto_realtime_ipc_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   3,
			NumExtensions: 0,
			NumServices:   0,
		},
		GoTypes:           file_api_proto_realtime_ipc_proto_goTypes,
		DependencyIndexes: file_api_proto_realtime_ipc_proto_depIdxs,
		MessageInfos:      file_api_proto_realtime_ipc_proto_msgTypes,
	}.Build()
	File_api_proto_realtime_ipc_proto = out.File
	file_api_proto_realtime_ipc_proto_rawDesc = nil
	file_api_proto_realtime_ipc_proto_goTypes = nil
	file_api_proto_realtime_ipc_proto_depIdxs = nil
}
